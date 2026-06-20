import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasUploadFile } from '@/lib/gas'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const semester = fd.get('semester') as string
  const type = fd.get('type') as string   // 'settlement' | 'remittance'
  const reason = (fd.get('reason') as string)?.trim()

  if (!file || !semester || !type || !reason) {
    return NextResponse.json({ error: '資料不完整，請選擇檔案並填寫原因' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: '檔案大小不可超過 20MB' }, { status: 400 })
  }

  const requestType = type === 'settlement' ? 'scan_reupload' : 'remittance_reupload'
  const schoolYear = await getActiveSchoolYear()

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
    return NextResponse.json({ error: '已有待審核的重新上傳申請' }, { status: 409 })
  }

  // 上傳檔案至待審暫存區
  const { gasUrl, gasSecret, driveFolderId } = await getGasSettings()
  if (!gasUrl) return NextResponse.json({ error: '尚未設定 GAS 網址' }, { status: 500 })
  if (!driveFolderId) return NextResponse.json({ error: '尚未設定 Google Drive 資料夾 ID' }, { status: 500 })

  const { data: school } = await supabaseAdmin
    .from('schools').select('code, name').eq('id', session.user.school_id).single()
  const label = type === 'settlement' ? '收支結算表掃描檔' : '賸餘款送款憑單'
  const code = String(school?.code || '').padStart(3, '0')
  const ext = file.name.split('.').pop()
  const filename = `PENDING_${code}_${school?.name}_第${semester}學期_${label}.${ext}`
  const bytes = await file.arrayBuffer()

  let pendingPath = ''
  try {
    pendingPath = await gasUploadFile({
      gasUrl, gasSecret, folderId: driveFolderId,
      subFolder: `${schoolYear}學年度/待審`,
      filename, mimeType: file.type || 'application/octet-stream', buffer: bytes,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `上傳失敗：${msg}` }, { status: 500 })
  }

  await supabaseAdmin.from('change_requests').insert({
    school_id: session.user.school_id,
    school_year: schoolYear,
    semester: Number(semester),
    request_type: requestType,
    reason,
    pending_file_path: pendingPath,
  })

  return NextResponse.json({ ok: true })
}
