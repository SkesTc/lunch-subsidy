import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()

  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  let query = supabaseAdmin
    .from('bank_accounts')
    .select('school_id, semester, confirmed_at, is_modified, bank_name, branch_name, bank_code, account_name, account_number')
    .eq('school_year', schoolYear)
  if (allowedIds !== null) {
    query = query.in('school_id', allowedIds.length ? allowedIds : [-1])
  }
  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolId, semester, bank_name, branch_name, bank_code, account_name, account_number } = await req.json()
  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  if (allowedIds !== null && !allowedIds.includes(Number(schoolId))) {
    return NextResponse.json({ error: '無權限修改此學校的帳戶資訊' }, { status: 403 })
  }
  const schoolYear = await getActiveSchoolYear()

  const { data: existing } = await supabaseAdmin
    .from('bank_accounts').select('id')
    .eq('school_id', schoolId).eq('semester', semester).eq('school_year', schoolYear).single()

  const payload = {
    school_id: schoolId, semester, school_year: schoolYear,
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
