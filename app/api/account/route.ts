import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))

  const { data } = await supabaseAdmin
    .from('bank_accounts')
    .select('*')
    .eq('school_id', session.user.school_id)
    .eq('semester', semester)
    .single()

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id || !session?.user?.email) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const body = await req.json()
  const { semester, bank_name, branch_name, bank_code, account_name, account_number, contact_name, contact_phone } = body

  // 取得現有資料判斷是否修改
  const { data: existing } = await supabaseAdmin
    .from('bank_accounts').select('*')
    .eq('school_id', session.user.school_id).eq('semester', semester).single()

  const isModified = existing?.is_preloaded ? (
    existing.bank_code !== bank_code || existing.account_number !== account_number
  ) : false

  const payload = {
    school_id: session.user.school_id,
    semester,
    bank_name, branch_name, bank_code, account_name, account_number, contact_name, contact_phone,
    confirmed_at: new Date().toISOString(),
    confirmed_by: session.user.email,
    is_modified: isModified,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await supabaseAdmin.from('bank_accounts').update(payload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('bank_accounts').insert({ ...payload, is_preloaded: false })
  }

  return NextResponse.json({ ok: true })
}
