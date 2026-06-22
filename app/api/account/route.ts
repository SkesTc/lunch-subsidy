import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))
  const { active_school_year, school_year } = await getAllSettings()
  const schoolYear = (active_school_year || school_year || '115') as string

  const { data } = await supabaseAdmin
    .from('bank_accounts').select('id, school_id, semester, bank_name, branch_name, bank_code, account_name, account_number, confirmed_at, is_modified, is_preloaded')
    .eq('school_id', session.user.school_id).eq('semester', semester).eq('school_year', schoolYear).single()

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id || !session?.user?.email) {
    return NextResponse.json({ error: '未登入' }, { status: 401 })
  }

  const body = await req.json()
  const { semester, bank_name, branch_name, bank_code, account_name, account_number, contact_name, contact_phone } = body
  const { active_school_year, school_year } = await getAllSettings()
  const schoolYear = (active_school_year || school_year || '115') as string

  const { data: existing } = await supabaseAdmin
    .from('bank_accounts').select('id, school_id, semester, bank_name, branch_name, bank_code, account_name, account_number, confirmed_at, is_modified, is_preloaded')
    .eq('school_id', session.user.school_id).eq('semester', semester).eq('school_year', schoolYear).single()

  const isModified = existing?.is_preloaded
    ? (existing.bank_code !== bank_code || existing.account_number !== account_number)
    : false

  const payload = {
    school_id: session.user.school_id,
    semester,
    school_year: schoolYear,
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
