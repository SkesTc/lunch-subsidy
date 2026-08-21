import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/settings'
import { getUserZoneRole, getZoneSchoolIds, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const planId = searchParams.get('plan_id')
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()

  if (searchParams.get('template') === '1') {
    const semester = Number(searchParams.get('semester') || '1')
    const { data: schools } = await supabaseAdmin
      .from('schools').select('id, code, district, name').eq('is_active', true).order('code')
    const { data: planInfo } = planId
      ? await supabaseAdmin.from('plans').select('name, label, semester').eq('id', planId).single()
      : { data: null }
    const { data: existing } = planId
      ? await supabaseAdmin.from('plan_amounts').select('school_id, amount').eq('plan_id', planId).eq('school_year', schoolYear).eq('semester', semester)
      : { data: [] }
    const amtMap = Object.fromEntries((existing || []).map(r => [r.school_id, r.amount]))
    const rows = (schools || []).map(s => ({ '編號': s.code, '區別': s.district, '學校名稱': s.name, '核定金額': amtMap[s.id] || 0 }))
    const wb = XLSX.utils.book_new()
    const sheetName = planInfo?.semester == null ? `第${semester}學期核定金額` : '核定金額'
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const label = planInfo?.label || 'plan'
    const semSuffix = planInfo?.semester == null ? `_S${semester}` : ''
    const filename = encodeURIComponent(`${label}${semSuffix}_核定金額範本.xlsx`)
    return new Response(buf, {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${filename}` }
    })
  }

  // 回傳某計畫所有學校金額（依分區過濾）
  const zoneUserGet = await getUserZoneRole(session.user.email!)
  const allowedIdsGet = zoneUserGet ? await getZoneSchoolIds(zoneUserGet) : null
  let query = supabaseAdmin.from('plan_amounts').select('school_id, plan_id, semester, amount').eq('school_year', schoolYear)
  if (planId) query = query.eq('plan_id', planId)
  if (allowedIdsGet !== null) query = query.in('school_id', allowedIdsGet.length ? allowedIdsGet : [-1])
  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const zoneUserPost = await getUserZoneRole(session.user.email!)
  const allowedIdsPost = zoneUserPost ? await getZoneSchoolIds(zoneUserPost) : null

  const ct = req.headers.get('content-type') || ''

  if (ct.includes('multipart/form-data')) {
    // Excel 批次匯入限 super_admin
    if (!zoneUserPost || !isSuperAdmin(zoneUserPost)) return NextResponse.json({ error: '僅限超級管理者匯入' }, { status: 403 })
    // 批次匯入 Excel
    const fd = await req.formData()
    const file = fd.get('file') as File
    const planId = fd.get('plan_id') as string
    const schoolYear = (fd.get('school_year') as string) || await getActiveSchoolYear()
    if (!file || !planId) return NextResponse.json({ error: '缺少檔案或 plan_id' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const wb = XLSX.read(bytes, { type: 'buffer' })
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])

    const { data: schools } = await supabaseAdmin.from('schools').select('id, code').eq('is_active', true)
    const codeMap = Object.fromEntries((schools || []).map(s => [String(s.code), s.id]))

    let updated = 0
    const errors: string[] = []
    for (const row of rows) {
      const code = String(row['編號'] || row['code'] || '')
      const amount = Number(row['核定金額'] || row['amount'] || 0)
      const schoolId = codeMap[code]
      if (!schoolId) { errors.push(`找不到學校編號 ${code}`); continue }
      const semVal = Number(fd.get('semester') || '1') || 1
      const { error } = await supabaseAdmin.from('plan_amounts').upsert(
        { school_id: schoolId, plan_id: planId, school_year: schoolYear, semester: semVal, amount, updated_at: new Date().toISOString() },
        { onConflict: 'school_id,plan_id,school_year,semester' }
      )
      if (error) errors.push(`${code}: ${error.message}`)
      else updated++
    }
    return NextResponse.json({ ok: true, updated, errors })
  }

  // 單筆或批次更新
  const body = await req.json()
  const schoolYear = body.school_year || await getActiveSchoolYear()
  const now = new Date().toISOString()

  if (Array.isArray(body.rows)) {
    const upsertRows = body.rows
      .filter((r: { school_id: number }) => allowedIdsPost === null || allowedIdsPost.includes(Number(r.school_id)))
      .map((r: { plan_id: string; school_id: number; semester?: number; amount: number }) => ({
        school_id: r.school_id, plan_id: r.plan_id, school_year: schoolYear,
        semester: r.semester ?? 1, amount: r.amount, updated_at: now,
      }))
    const { error } = await supabaseAdmin.from('plan_amounts').upsert(upsertRows, { onConflict: 'school_id,plan_id,school_year,semester' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, updated: upsertRows.length })
  }

  const { school_id, plan_id, amount, semester: sem } = body
  if (allowedIdsPost !== null && !allowedIdsPost.includes(Number(school_id))) {
    return NextResponse.json({ error: '無權限修改此學校的計畫金額' }, { status: 403 })
  }
  const { error } = await supabaseAdmin.from('plan_amounts').upsert(
    { school_id, plan_id, school_year: schoolYear, semester: sem ?? 1, amount, updated_at: now },
    { onConflict: 'school_id,plan_id,school_year,semester' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
