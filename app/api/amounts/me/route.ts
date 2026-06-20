import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const schoolYear = await getActiveSchoolYear()
  const { data } = await supabaseAdmin
    .from('school_amounts').select('sem1_amount, sem2_amount, approved_total')
    .eq('school_id', session.user.school_id).eq('school_year', schoolYear).single()
  return NextResponse.json(data || null)
}
