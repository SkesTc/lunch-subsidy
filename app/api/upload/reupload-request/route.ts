import { auth } from '@/lib/auth'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasUploadFile } from '@/lib/gas'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const semester = fd.get('semester') as string
  const type = fd.get('type') as string
  const reason = (fd.get('reason') as string)?.trim()
  const planId = (fd.get('plan_id') as string | null) || null

  if (!file || !semester || !type || !reason) {
    return NextResponse.json({ error: '資料不完整，請選擇檔案並填寫原因' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: '檔案大小不可超過 20MB' }, { status: 400 })
  }

  const requestType = type === 'settlement' ? 'scan_reupload' : 'remittance_reupload'
  const schoolYear = await getActiveSchoolYear()

  // 檢查是否已有待審核申請
  let existingQ = supabaseAdmin.from('change_requests').select('id')
    .eq('school_id', schoolId).eq('school_year', schoolYear)
    .eq('request_type', requestType).eq('status', 'pending')
  if (planId) existingQ = existingQ.eq('plan_id', planId)
  else existingQ = existingQ.eq('semester', Number(semester))
  const { data: existing } = await existingQ.maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '已有待審核的重新上傳申請' }, { status: 409 })
  }

  // 上傳檔案至待審暫存區
  const { gasUrl, gasSecret, driveFolderId } = await getGasSettings()
  if (!gasUrl) return NextResponse.json({ error: '尚未設定 GAS 網址' }, { status: 500 })
  if (!driveFolderId) return NextResponse.json({ error: '尚未設定 Google Drive 資料夾 ID' }, { status: 500 })

  const { data: school } = await supabaseAdmin
    .from('schools').select('code, name, zone_id').eq('id', schoolId).single()
  let zoneName = ''
  if (school?.zone_id) {
    const { data: zone } = await supabaseAdmin.from('zones').select('name').eq('id', school.zone_id).single()
    zoneName = zone?.name || ''
  }
  const label = type === 'settlement' ? '收支結算表掃描檔' : '賸餘款送款憑單'
  const codePrefix = zoneName ? `${zoneName}-${String(school?.code || '').padStart(3, '0')}` : String(school?.code || '').padStart(3, '0')
  const ext = file.name.split('.').pop()
  const filename = `PENDING_${codePrefix}_${school?.name}_第${semester}學期_${label}.${ext}`
  const bytes = await file.arrayBuffer()
  const zoneFolder = zoneName ? `${zoneName}/` : ''

  let pendingPath = ''
  try {
    pendingPath = await gasUploadFile({
      gasUrl, gasSecret, folderId: driveFolderId,
      subFolder: `${schoolYear}學年度/${zoneFolder}待審`,
      filename, mimeType: file.type || 'application/octet-stream', buffer: bytes,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `上傳失敗：${msg}` }, { status: 500 })
  }

  const { error: insertError } = await supabaseAdmin.from('change_requests').insert({
    school_id: schoolId,
    school_year: schoolYear,
    semester: Number(semester),
    ...(planId ? { plan_id: planId } : {}),
    request_type: requestType,
    reason,
    pending_file_path: pendingPath,
  })

  if (insertError) return NextResponse.json({ error: `建立審核記錄失敗：${insertError.message}` }, { status: 500 })
  return NextResponse.json({ ok: true })
}
