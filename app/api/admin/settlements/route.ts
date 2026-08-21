import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const schoolYear = await getActiveSchoolYear()
  const zoneUser = await getUserZoneRole(session.user.email!)
  const schoolIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  let query = supabaseAdmin
    .from('settlements')
    .select('id, school_id, semester, plan_id, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, total_expense, amount_locked, scan_reupload_allowed, remittance_reupload_allowed')
    .eq('school_year', schoolYear)

  if (schoolIds !== null) {
    query = query.in('school_id', schoolIds.length ? schoolIds : [-1])
  }

  const { data } = await query
  return NextResponse.json(data ?? [])
}
