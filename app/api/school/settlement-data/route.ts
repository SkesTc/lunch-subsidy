import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'

/**
 * 合併 settlement 頁面需要的所有資料（原本 4 個 API 呼叫 → 1 個）
 * 取代：/api/schools/me + /api/settlement + /api/settings/public + /api/amounts/me
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester') || '1')

  // getAllSettings() 走快取，取 schoolYear 幾乎免費
  const settings = await getAllSettings()
  const schoolYear = settings.active_school_year || settings.school_year || '115'

  const [{ data: school }, { data: settlement }, { data: amounts }] = await Promise.all([
    supabaseAdmin
      .from('schools')
      .select('id, code, district, name')
      .eq('id', session.user.school_id)
      .single(),
    supabaseAdmin
      .from('settlements')
      .select('id, status, business_expense, total_expense, surplus, repay_amount, amount_locked')
      .eq('school_id', session.user.school_id)
      .eq('semester', semester)
      .eq('school_year', schoolYear)
      .single(),
    supabaseAdmin
      .from('school_amounts')
      .select('sem1_amount, sem2_amount, approved_total')
      .eq('school_id', session.user.school_id)
      .eq('school_year', schoolYear)
      .single(),
  ])

  return NextResponse.json({
    school: school || null,
    settlement: settlement || null,
    amounts: amounts || null,
    schoolYear,
    planName: settings.plan_name || '',
  })
}
