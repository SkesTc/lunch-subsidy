import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()
  const { data } = await supabaseAdmin
    .from('school_amounts').select('*').eq('school_year', schoolYear)
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { school_id, school_year, sem1_amount, sem2_amount } = await req.json()
  const approved_total = (sem1_amount || 0) + (sem2_amount || 0)

  const { data: existing } = await supabaseAdmin
    .from('school_amounts').select('id').eq('school_id', school_id).eq('school_year', school_year).single()

  if (existing) {
    await supabaseAdmin.from('school_amounts')
      .update({ sem1_amount, sem2_amount, approved_total })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('school_amounts')
      .insert({ school_id, school_year, sem1_amount, sem2_amount, approved_total })
  }

  return NextResponse.json({ ok: true })
}
