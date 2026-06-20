import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const schoolYear = await getActiveSchoolYear()
  const { data } = await supabaseAdmin
    .from('settlements')
    .select('id, school_id, semester, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, total_expense')
    .eq('school_year', schoolYear)

  return NextResponse.json(data ?? [])
}
