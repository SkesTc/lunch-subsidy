import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Excel 欄位：編號, 學校名稱, 銀行名稱, 分行名稱, 金融機構代碼, 帳戶戶名, 帳號, 聯絡人, 聯絡電話
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const fd = await req.formData()
  const file = fd.get('file') as File
  const semester = Number(fd.get('semester'))
  if (!file) return NextResponse.json({ error: '無檔案' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const wb = XLSX.read(bytes, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws)

  let imported = 0
  for (const row of rows) {
    const code = Number(row['編號'] || row['code'])
    if (!code) continue

    const { data: school } = await supabaseAdmin
      .from('schools').select('id').eq('code', code).single()
    if (!school) continue

    await supabaseAdmin.from('bank_accounts').upsert({
      school_id: school.id,
      semester,
      bank_name: row['銀行名稱'] || '',
      branch_name: row['分行名稱'] || '',
      bank_code: row['金融機構代碼'] || '',
      account_name: row['帳戶戶名'] || '',
      account_number: row['帳號'] || '',
      contact_name: row['聯絡人'] || '',
      contact_phone: row['聯絡電話'] || '',
      is_preloaded: true,
      is_modified: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'school_id,semester' })
    imported++
  }

  return NextResponse.json({ ok: true, imported })
}
