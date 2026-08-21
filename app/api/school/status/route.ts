import { auth } from '@/lib/auth'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/settings'
import { NextResponse } from 'next/server'

/**
 * 單一請求回傳學校指定學期的結算資料 + 待審核申請
 * 取代 /api/settlement + /api/settlement/change-request 的雙重呼叫
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester') || '1')
  const planId = searchParams.get('plan_id') || null
  const schoolYear = await getActiveSchoolYear()

  const settlementQuery = planId
    ? supabaseAdmin.from('settlements').select('id, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, business_expense, total_expense, amount_locked, plan_id')
        .eq('school_id', schoolId).eq('school_year', schoolYear).eq('plan_id', planId).eq('semester', semester).maybeSingle()
    : supabaseAdmin.from('settlements').select('id, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, business_expense, total_expense, amount_locked')
        .eq('school_id', schoolId).eq('semester', semester).eq('school_year', schoolYear).maybeSingle()

  const changeQuery = planId
    ? supabaseAdmin.from('change_requests').select('id, semester, plan_id, request_type, status, pending_file_path, reason, created_at')
        .eq('school_id', schoolId).eq('school_year', schoolYear).eq('plan_id', planId).order('created_at', { ascending: false })
    : supabaseAdmin.from('change_requests').select('id, semester, request_type, status, pending_file_path, reason, created_at')
        .eq('school_id', schoolId).eq('school_year', schoolYear).eq('semester', semester).order('created_at', { ascending: false })

  const [{ data: settlement }, { data: pendingRequests }] = await Promise.all([settlementQuery, changeQuery])

  return NextResponse.json({
    settlement: settlement || null,
    pendingRequests: pendingRequests || [],
  })
}
