import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { data: schools } = await supabaseAdmin
    .from('schools').select('code, name, district').eq('is_active', true).order('code')

  const rows = (schools || []).map((s: { code: number; name: string; district: string }) => ({
    '編號': s.code,
    '區別': s.district,
    '學校名稱': s.name,
    '銀行名稱': '',
    '分行名稱': '',
    '金融機構代碼': '',
    '帳戶戶名': '',
    '帳號': '',
    '聯絡人': '',
    '聯絡電話': '',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [8, 8, 20, 12, 12, 10, 14, 16, 8, 12].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, '帳戶資料')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="bank_template.xlsx"',
    },
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const fd = await req.formData()
  const file = fd.get('file') as File
  const semester = Number(fd.get('semester'))
  if (!file) return NextResponse.json({ error: '無檔案' }, { status: 400 })

  const schoolYear = await getActiveSchoolYear()

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

    const payload = {
      school_id: school.id,
      semester,
      school_year: schoolYear,
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
    }

    const { data: existing } = await supabaseAdmin
      .from('bank_accounts').select('id')
      .eq('school_id', school.id).eq('semester', semester).eq('school_year', schoolYear).single()

    if (existing) {
      await supabaseAdmin.from('bank_accounts').update(payload).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('bank_accounts').insert(payload)
    }
    imported++
  }

  return NextResponse.json({ ok: true, imported })
}
