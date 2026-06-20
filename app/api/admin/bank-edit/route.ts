import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()
  const { data: schools } = await supabaseAdmin.from('schools').select('id').eq('school_year_start', schoolYear)
  const schoolIds = (schools || []).map((s: { id: number }) => s.id)
  const { data } = await supabaseAdmin
    .from('bank_accounts')
    .select('school_id, semester, confirmed_at, is_modified, bank_name, branch_name, bank_code, account_name, account_number')
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolId, semester, bank_name, branch_name, bank_code, account_name, account_number } = await req.json()

  const { data: existing } = await supabaseAdmin
    .from('bank_accounts').select('id')
    .eq('school_id', schoolId).eq('semester', semester).single()

  const payload = {
    school_id: schoolId, semester,
    bank_name, branch_name, bank_code, account_name, account_number,
    is_modified: true,
    confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await supabaseAdmin.from('bank_accounts').update(payload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('bank_accounts').insert({ ...payload, is_preloaded: false })
  }

  return NextResponse.json({ ok: true })
}
