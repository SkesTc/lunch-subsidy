import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(req: Request) {
  // Download template
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const schoolYear = searchParams.get('school_year') || '115'

  const { data: schools } = await supabaseAdmin
    .from('schools').select('id, code, district, name').eq('is_active', true).order('code')

  const { data: existing } = await supabaseAdmin
    .from('school_amounts').select('*').eq('school_year', schoolYear)

  const rows = (schools || []).map(s => {
    const a = existing?.find(x => x.school_id === s.id)
    return {
      '編號': s.code,
      '區別': s.district,
      '學校名稱': s.name,
      '第1學期核定金額': a?.sem1_amount || 0,
      '第2學期核定金額': a?.sem2_amount || 0,
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 6 }, { wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '核定金額')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${schoolYear}_amounts_template.xlsx"`,
    }
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const schoolYear = fd.get('school_year') as string
  if (!file || !schoolYear) return NextResponse.json({ error: '缺少檔案或學年度' }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  const { data: schools } = await supabaseAdmin
    .from('schools').select('id, code').eq('is_active', true)

  let updated = 0
  let errors: string[] = []

  for (const row of rows) {
    const code = Number(row['編號'])
    const sem1 = Number(row['第1學期核定金額'] || 0)
    const sem2 = Number(row['第2學期核定金額'] || 0)
    if (!code) continue

    const school = schools?.find(s => s.code === code)
    if (!school) { errors.push(`編號 ${code} 找不到學校`); continue }

    const { data: existing } = await supabaseAdmin
      .from('school_amounts').select('id').eq('school_id', school.id).eq('school_year', schoolYear).single()

    const payload = { school_id: school.id, school_year: schoolYear, sem1_amount: sem1, sem2_amount: sem2, approved_total: sem1 + sem2 }
    if (existing) {
      await supabaseAdmin.from('school_amounts').update(payload).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('school_amounts').insert(payload)
    }
    updated++
  }

  return NextResponse.json({ ok: true, updated, errors })
}
