import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasUploadFile } from '@/lib/gas'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File
  const semester = fd.get('semester') as string
  const type = fd.get('type') as 'settlement' | 'remittance'
  const remittanceDate = fd.get('remittance_date') as string | null

  if (!file) return NextResponse.json({ error: '無檔案' }, { status: 400 })

  const [{ gasUrl, gasSecret, driveFolderId }, schoolYear] = await Promise.all([
    getGasSettings(), getActiveSchoolYear(),
  ])
  if (!gasUrl) return NextResponse.json({ error: '尚未設定 GAS 網址，請至後台系統設定填入' }, { status: 500 })
  if (!driveFolderId) return NextResponse.json({ error: '尚未設定 Google Drive 資料夾 ID，請至後台系統設定填入' }, { status: 500 })

  const requestType = type === 'settlement' ? 'scan_upload' : 'remittance_upload'

  // 檢查是否已有待審核申請
  const { data: existing } = await supabaseAdmin
    .from('change_requests')
    .select('id')
    .eq('school_id', session.user.school_id)
    .eq('school_year', schoolYear)
    .eq('semester', Number(semester))
    .eq('request_type', requestType)
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({ error: '已有待審核的上傳申請' }, { status: 409 })
  }

  const ext = file.name.split('.').pop()
  const bytes = await file.arrayBuffer()

  const { data: school } = await supabaseAdmin
    .from('schools').select('code, name').eq('id', session.user.school_id).single()
  const label = type === 'settlement' ? '收支結算表掃描檔' : '賸餘款送款憑單'
  const code = String(school?.code || '').padStart(3, '0')
  const filename = `${code}_${school?.name}_第${semester}學期_${label}.${ext}`

  let storedPath = ''
  try {
    storedPath = await gasUploadFile({
      gasUrl, gasSecret, folderId: driveFolderId,
      subFolder: `${schoolYear}學年度/第${semester}學期`,
      filename, mimeType: file.type || 'application/octet-stream', buffer: bytes,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `上傳失敗：${msg}` }, { status: 500 })
  }

  // 建立 change_request 待審核
  const reason = type === 'remittance' && remittanceDate ? `DATE:${remittanceDate}` : '首次上傳'

  const { error: insertError } = await supabaseAdmin.from('change_requests').insert({
    school_id: session.user.school_id,
    school_year: schoolYear,
    semester: Number(semester),
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
