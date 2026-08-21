import { auth } from '@/lib/auth'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'
import { calcRatio, calcSurplus, calcRepay } from '@/lib/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json(null)
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json(null)
  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))
  const { active_school_year, school_year } = await getAllSettings()
  const schoolYear = (active_school_year || school_year || '115') as string
  const { data } = await supabaseAdmin
    .from('settlements').select('id, school_id, semester, school_year, status, business_expense, total_expense, surplus, repay_amount, scan_file_path, remittance_file_path, remittance_date, amount_locked, updated_at')
    .eq('school_id', schoolId).eq('semester', semester).eq('school_year', schoolYear).single()
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })

  const body = await req.json()
  const { semester, personnel_expense, business_expense, equipment_expense, plan_id } = body
  const { active_school_year, school_year } = await getAllSettings()
  const schoolYear = (active_school_year || school_year || '115') as string

  let A = 0
  if (plan_id) {
    const { data: pa } = await supabaseAdmin.from('plan_amounts').select('amount')
      .eq('school_id', schoolId).eq('plan_id', plan_id)
      .eq('school_year', schoolYear).eq('semester', semester).maybeSingle()
    A = pa?.amount || 0
  } else {
    const { data: amountRow } = await supabaseAdmin
      .from('school_amounts').select('sem1_amount, sem2_amount').eq('school_id', schoolId).eq('school_year', schoolYear).single()
    if (!amountRow) return NextResponse.json({ error: '找不到核定金額，請聯絡承辦學校' }, { status: 400 })
    A = semester === 1 ? amountRow.sem1_amount : amountRow.sem2_amount
  }
  const B = A
  const D = personnel_expense + business_expense + equipment_expense
  const C = calcRatio(B, A)
  const E = calcSurplus(A, D)
  const F = calcRepay(E, C)

  const payload: Record<string, unknown> = {
    school_id: schoolId,
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
    ...(plan_id ? { plan_id } : {}),
  }

  // 兩段查找：優先找 plan_id+semester 精確匹配，再找舊的無 plan_id 記錄
  let existingId: string | null = null

  if (plan_id) {
    // 第一優先：找已有 plan_id 的同學期記錄
    const { data: d1 } = await supabaseAdmin.from('settlements').select('id')
      .eq('school_id', schoolId).eq('plan_id', plan_id)
      .eq('semester', semester).eq('school_year', schoolYear).maybeSingle()
    if (d1) existingId = d1.id

    if (!existingId) {
      // 第二：找舊的無 plan_id 同學期記錄（首次綁定 plan）
      const { data: d2 } = await supabaseAdmin.from('settlements').select('id')
        .eq('school_id', schoolId).eq('semester', semester)
        .eq('school_year', schoolYear).is('plan_id', null).maybeSingle()
      if (d2) existingId = d2.id
    }
  } else {
    // 無 plan_id：只找無 plan_id 的同學期記錄
    const { data: d } = await supabaseAdmin.from('settlements').select('id')
      .eq('school_id', schoolId).eq('semester', semester)
      .eq('school_year', schoolYear).is('plan_id', null).maybeSingle()
    if (d) existingId = d.id
  }

  if (existingId) {
    const { error } = await supabaseAdmin.from('settlements').update(payload).eq('id', existingId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin.from('settlements').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, D, E, F })
}
