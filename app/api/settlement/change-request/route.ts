import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const semester = searchParams.get('semester')
  const schoolYear = await getActiveSchoolYear()
  let query = supabaseAdmin
    .from('change_requests')
    .select('id, semester, request_type, status, pending_file_path, reason, created_at')
    .eq('school_id', session.user.school_id)
    .eq('school_year', schoolYear)
    .order('created_at', { ascending: false })
  if (semester) query = query.eq('semester', Number(semester))
  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { semester, new_amount, reason } = await req.json()
  if (!semester || !new_amount || !reason?.trim()) {
    return NextResponse.json({ error: '資料不完整' }, { status: 400 })
  }

  const schoolYear = await getActiveSchoolYear()

  // 檢查是否已有待審核申請
  const { data: existing } = await supabaseAdmin
    .from('change_requests')
    .select('id')
    .eq('school_id', session.user.school_id)
    .eq('school_year', schoolYear)
    .eq('semester', semester)
    .eq('request_type', 'amount_modify')
    .eq('status', 'pending')
    .single()

  if (existing) {
    return NextResponse.json({ error: '已有待審核的修改申請，請等待審核完成' }, { status: 409 })
  }

  await supabaseAdmin.from('change_requests').insert({
    school_id: session.user.school_id,
    school_year: schoolYear,
    semester,
    request_type: 'amount_modify',
    new_amount,
    reason: reason.trim(),
  })

  return NextResponse.json({ ok: true })
}
