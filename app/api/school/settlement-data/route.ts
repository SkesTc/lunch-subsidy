import { auth } from '@/lib/auth'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'

/**
 * 合併 settlement 頁面需要的所有資料（原本 4 個 API 呼叫 → 1 個）
 * 取代：/api/schools/me + /api/settlement + /api/settings/public + /api/amounts/me
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const semester = Number(searchParams.get('semester') || '1')
  const planId = searchParams.get('plan_id') || null

  const settings = await getAllSettings()
  const schoolYear = (settings.active_school_year || settings.school_year || '115') as string

  const settlementQuery = planId
    ? supabaseAdmin.from('settlements').select('id, status, business_expense, total_expense, surplus, repay_amount, amount_locked, plan_id')
        .eq('school_id', schoolId).eq('school_year', schoolYear).eq('plan_id', planId).eq('semester', semester).maybeSingle()
    : supabaseAdmin.from('settlements').select('id, status, business_expense, total_expense, surplus, repay_amount, amount_locked')
        .eq('school_id', schoolId).eq('semester', semester).eq('school_year', schoolYear).is('plan_id', null).maybeSingle()

  const [{ data: school }, { data: settlement }, { data: amounts }, planData] = await Promise.all([
    supabaseAdmin.from('schools').select('id, code, district, name, zone_id').eq('id', schoolId).single(),
    settlementQuery,
    supabaseAdmin.from('school_amounts').select('sem1_amount, sem2_amount, approved_total').eq('school_id', schoolId).eq('school_year', schoolYear).maybeSingle(),
    planId
      ? Promise.all([
          supabaseAdmin.from('plans').select('name, label, semester, deduct_s1_repay').eq('id', planId).single(),
          supabaseAdmin.from('plan_amounts').select('amount').eq('school_id', schoolId).eq('plan_id', planId).eq('school_year', schoolYear).eq('semester', semester).maybeSingle(),
          // 全學年計畫第2學期：取第1學期結算的 repay_amount 用於顯示扣抵
          semester === 2
            ? supabaseAdmin.from('settlements').select('repay_amount').eq('school_id', schoolId).eq('plan_id', planId).eq('school_year', schoolYear).eq('semester', 1).maybeSingle()
            : Promise.resolve({ data: null }),
        ])
      : Promise.resolve(null),
  ])

  const planInfo = planData ? planData[0].data : null
  const planAmount = planData ? (planData[1].data?.amount ?? 0) : null
  const sem1Repay = planData ? (planData[2].data?.repay_amount ?? 0) : null
  const shouldDeduct = planInfo?.semester == null && planInfo?.deduct_s1_repay === true && semester === 2

  let zoneName = ''
  const zoneId = (school as { zone_id?: number | null } | null)?.zone_id
  if (zoneId) {
    const { data: zone } = await supabaseAdmin.from('zones').select('name').eq('id', zoneId).single()
    zoneName = zone?.name || ''
  }

  return NextResponse.json({
    school: school || null,
    zoneName,
    settlement: settlement || null,
    amounts: amounts || null,
    schoolYear,
    planName: planInfo?.name || settings.plan_name || '',
    planId: planId || null,
    planLabel: planInfo ? (planInfo.semester == null ? `${planInfo.label}・第${semester}學期` : planInfo.label) : null,
    planAmount: planAmount,
    sem1Repay: shouldDeduct ? sem1Repay : null,
  })
}
