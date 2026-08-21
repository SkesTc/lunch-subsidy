import { auth } from '@/lib/auth'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const semester = searchParams.get('semester')
  const schoolYear = await getActiveSchoolYear()
  let query = supabaseAdmin
    .from('change_requests')
    .select('id, semester, request_type, status, pending_file_path, reason, created_at')
    .eq('school_id', schoolId)
    .eq('school_year', schoolYear)
    .order('created_at', { ascending: false })
  if (semester) query = query.eq('semester', Number(semester))
  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })

  const { semester, plan_id, new_amount, reason } = await req.json()
  if (!semester || !new_amount || !reason?.trim()) {
    return NextResponse.json({ error: '資料不完整' }, { status: 400 })
  }

  const schoolYear = await getActiveSchoolYear()

  // 檢查是否已有待審核申請
  let existingQ = supabaseAdmin.from('change_requests').select('id')
    .eq('school_id', schoolId).eq('school_year', schoolYear)
    .eq('request_type', 'amount_modify').eq('status', 'pending')
  if (plan_id) existingQ = existingQ.eq('plan_id', plan_id)
  else existingQ = existingQ.eq('semester', semester)
  const { data: existing } = await existingQ.maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '已有待審核的修改申請，請等待審核完成' }, { status: 409 })
  }

  const { error } = await supabaseAdmin.from('change_requests').insert({
    school_id: schoolId,
    school_year: schoolYear,
    semester,
    ...(plan_id ? { plan_id } : {}),
    request_type: 'amount_modify',
    new_amount,
    reason: reason.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
