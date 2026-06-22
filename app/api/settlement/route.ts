import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'
import { calcRatio, calcSurplus, calcRepay } from '@/lib/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))
  const { active_school_year, school_year } = await getAllSettings()
  const schoolYear = (active_school_year || school_year || '115') as string
  const { data } = await supabaseAdmin
    .from('settlements').select('id, school_id, semester, school_year, status, business_expense, total_expense, surplus, repay_amount, scan_file_path, remittance_file_path, remittance_date, amount_locked, updated_at')
    .eq('school_id', session.user.school_id).eq('semester', semester).eq('school_year', schoolYear).single()
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const body = await req.json()
  const { semester, personnel_expense, business_expense, equipment_expense } = body
  const { active_school_year, school_year } = await getAllSettings()
  const schoolYear = (active_school_year || school_year || '115') as string

  const { data: amountRow } = await supabaseAdmin
    .from('school_amounts').select('sem1_amount, sem2_amount').eq('school_id', session.user.school_id).eq('school_year', schoolYear).single()
  if (!amountRow) return NextResponse.json({ error: '找不到核定金額，請聯絡承辦學校' }, { status: 400 })

  const A = semester === 1 ? amountRow.sem1_amount : amountRow.sem2_amount
  const B = A
  const D = personnel_expense + business_expense + equipment_expense
  const C = calcRatio(B, A)
  const E = calcSurplus(A, D)
  const F = calcRepay(E, C)

  const payload = {
    school_id: session.user.school_id,
    semester,
    school_year: schoolYear,
    personnel_expense,
    business_expense,
    equipment_expense,
    total_expense: D,
    surplus: E,
    repay_amount: F,
    status: 'downloaded',
    amount_locked: true,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabaseAdmin
    .from('settlements').select('id')
    .eq('school_id', session.user.school_id).eq('semester', semester).eq('school_year', schoolYear).single()

  if (existing) {
    await supabaseAdmin.from('settlements').update(payload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('settlements').insert(payload)
  }

  return NextResponse.json({ ok: true, D, E, F })
}
