import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getGasSettings, gasUploadFile } from '@/lib/gas'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

function requestPath(schoolId: number, schoolYear: string) {
  return `__account-changes/${schoolId}_${schoolYear}.json`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const schoolYear = await getActiveSchoolYear()
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(requestPath(session.user.school_id, schoolYear))
    if (data) return NextResponse.json(JSON.parse(await data.text()))
  } catch { /* no request yet */ }
  return NextResponse.json(null)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File | null
  const bank_name = fd.get('bank_name') as string
  const branch_name = fd.get('branch_name') as string
  const bank_code = fd.get('bank_code') as string
  const account_name = fd.get('account_name') as string
  const account_number = fd.get('account_number') as string

  if (!file) return NextResponse.json({ error: '請上傳帳戶資訊圖檔' }, { status: 400 })

  const schoolYear = await getActiveSchoolYear()
  const { data: school } = await supabaseAdmin
    .from('schools').select('code, name').eq('id', session.user.school_id).single()

  const { gasUrl, gasSecret, driveFolderId } = await getGasSettings()
  if (!gasUrl || !driveFolderId) return NextResponse.json({ error: '尚未設定 GAS 或 Drive，請聯絡承辦學校' }, { status: 500 })

  const ext = file.name.split('.').pop()
  const code = String(school?.code || '').padStart(3, '0')
  const filename = `${code}_${school?.name}_${schoolYear}學年度_帳戶變更申請.${ext}`

  let fileId = ''
  try {
    fileId = await gasUploadFile({
      gasUrl, gasSecret, folderId: driveFolderId,
      subFolder: `${schoolYear}學年度/帳戶變更申請`,
      filename,
      mimeType: file.type || 'application/octet-stream',
      buffer: await file.arrayBuffer(),
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: `圖檔上傳失敗：${e instanceof Error ? e.message : e}` }, { status: 500 })
  }

  const payload = {
    school_id: session.user.school_id,
    school_name: school?.name || '',
    school_code: school?.code || '',
    school_year: schoolYear,
    status: 'pending',
    new_info: { bank_name, branch_name, bank_code, account_name, account_number },
    file_id: fileId,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    admin_note: '',
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  await supabaseAdmin.storage.from(BUCKET).upload(
    requestPath(session.user.school_id, schoolYear), blob, { upsert: true, contentType: 'application/json' }
  )

  return NextResponse.json({ ok: true })
}
