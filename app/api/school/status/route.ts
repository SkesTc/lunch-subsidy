import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/settings'
import { NextResponse } from 'next/server'

/**
 * 單一請求回傳學校指定學期的結算資料 + 待審核申請
 * 取代 /api/settlement + /api/settlement/change-request 的雙重呼叫
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester') || '1')
  const schoolYear = await getActiveSchoolYear()

  const [{ data: settlement }, { data: pendingRequests }] = await Promise.all([
    supabaseAdmin
      .from('settlements')
      .select('id, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, business_expense, total_expense, amount_locked')
      .eq('school_id', session.user.school_id)
      .eq('semester', semester)
      .eq('school_year', schoolYear)
      .single(),
    supabaseAdmin
      .from('change_requests')
      .select('id, semester, request_type, status, pending_file_path, reason, created_at')
      .eq('school_id', session.user.school_id)
      .eq('school_year', schoolYear)
      .eq('semester', semester)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    settlement: settlement || null,
    pendingRequests: pendingRequests || [],
  })
}
