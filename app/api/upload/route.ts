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
  const file = fd.get('file') as File
  const semester = fd.get('semester') as string
  const type = fd.get('type') as 'settlement' | 'remittance'
  const remittanceDate = fd.get('remittance_date') as string | null
  const planId = (fd.get('plan_id') as string | null) || null

  if (!file) return NextResponse.json({ error: '無檔案' }, { status: 400 })

  const [{ gasUrl, gasSecret, driveFolderId }, schoolYear] = await Promise.all([
    getGasSettings(), getActiveSchoolYear(),
  ])
  if (!gasUrl) return NextResponse.json({ error: '尚未設定 GAS 網址，請至後台系統設定填入' }, { status: 500 })
  if (!driveFolderId) return NextResponse.json({ error: '尚未設定 Google Drive 資料夾 ID，請至後台系統設定填入' }, { status: 500 })

  const requestType = type === 'settlement' ? 'scan_upload' : 'remittance_upload'

  // 檢查是否已有待審核申請
  let existingQuery = supabaseAdmin.from('change_requests').select('id')
    .eq('school_id', schoolId).eq('school_year', schoolYear)
    .eq('request_type', requestType).eq('status', 'pending')
  if (planId) existingQuery = existingQuery.eq('plan_id', planId)
  else existingQuery = existingQuery.eq('semester', Number(semester))
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '已有待審核的上傳申請' }, { status: 409 })
  }

  const ext = file.name.split('.').pop()
  const bytes = await file.arrayBuffer()

  const { data: school } = await supabaseAdmin
    .from('schools').select('code, name, zone_id').eq('id', schoolId).single()
  let zoneName = ''
  if (school?.zone_id) {
    const { data: zone } = await supabaseAdmin.from('zones').select('name').eq('id', school.zone_id).single()
    zoneName = zone?.name || ''
  }
  const label = type === 'settlement' ? '收支結算表掃描檔' : '賸餘款送款憑單'
  const codePrefix = zoneName ? `${zoneName}-${String(school?.code || '').padStart(3, '0')}` : String(school?.code || '').padStart(3, '0')
  const baseFilename = `${codePrefix}_${school?.name}_第${semester}學期_${label}.${ext}`
  const filename = `待審_${baseFilename}`
  const zoneFolder = zoneName ? `${zoneName}/` : ''

  let storedPath = ''
  try {
    storedPath = await gasUploadFile({
      gasUrl, gasSecret, folderId: driveFolderId,
      subFolder: `${schoolYear}學年度/${zoneFolder}第${semester}學期`,
      filename, mimeType: file.type || 'application/octet-stream', buffer: bytes,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `上傳失敗：${msg}` }, { status: 500 })
  }

  // 建立 change_request 待審核
  const reason = type === 'remittance' && remittanceDate ? `DATE:${remittanceDate}` : '首次上傳'

  const { error: insertError } = await supabaseAdmin.from('change_requests').insert({
    school_id: schoolId,
    school_year: schoolYear,
    semester: Number(semester),
    ...(planId ? { plan_id: planId } : {}),
    request_type: requestType,
    pending_file_path: storedPath,
    reason,
    status: 'pending',
  })

  if (insertError) {
    console.error('change_requests insert error:', insertError)
    return NextResponse.json({ error: `建立審核記錄失敗：${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pending: true })
}
