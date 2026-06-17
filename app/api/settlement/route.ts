import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { calcRatio, calcSurplus, calcRepay } from '@/lib/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester'))
  const { data } = await supabaseAdmin
    .from('settlements').select('*')
    .eq('school_id', session.user.school_id).eq('semester', semester).single()
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const body = await req.json()
  const { semester, personnel_expense, business_expense, equipment_expense } = body

  // 取得核定金額
  const { data: school } = await supabaseAdmin
    .from('schools').select('sem1_amount, sem2_amount').eq('id', session.user.school_id).single()
  if (!school) return NextResponse.json({ error: '找不到學校' }, { status: 400 })

  const A = semester === 1 ? school.sem1_amount : school.sem2_amount
  const B = A
  const D = personnel_expense + business_expense + equipment_expense
  const C = calcRatio(B, A)
  const E = calcSurplus(A, D)
  const F = calcRepay(E, C)

  const payload = {
    school_id: session.user.school_id,
    semester,
    personnel_expense,
    business_expense,
    equipment_expense,
    total_expense: D,
    surplus: E,
    repay_amount: F,
    status: 'downloaded',
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await supabaseAdmin
    .from('settlements').select('id').eq('school_id', session.user.school_id).eq('semester', semester).single()

  if (existing) {
    await supabaseAdmin.from('settlements').update(payload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('settlements').insert(payload)
  }

  return NextResponse.json({ ok: true, D, E, F })
}
