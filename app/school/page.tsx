import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { getSettingsForZone } from '@/lib/settings'
import Navbar from '@/components/Navbar'
import ImpersonateBanner from '@/components/ImpersonateBanner'
import Link from 'next/link'
import { formatAmount } from '@/lib/utils'
import RebindButton from '@/components/RebindButton'
import ContactEditButton from '@/components/ContactEditButton'
import ReviewNotifications from '@/components/ReviewNotifications'

const SETTINGS_DEFAULTS = {
  block1_open: 'true', block1_deadline: '115學年度開學後',
  block2_open: 'true', block2_deadline: '2026-02-15',
  block3_open: 'false', block3_deadline: '2026-06-30',
}

export default async function SchoolDashboard() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  // 管理員模擬身分：讀取 cookie
  const cookieStore = await cookies()
  const impersonateCookie = cookieStore.get('school_impersonate')
  const impersonate = session.user.is_admin && impersonateCookie
    ? (() => { try { return JSON.parse(impersonateCookie.value) } catch { return null } })()
    : null
  const effectiveSchoolId: number = impersonate?.school_id ?? session.user.school_id!
  if (!effectiveSchoolId) redirect('/bind-school')

  // 先取得學校的 zone_id，再載入對應區別設定
  const { data: schoolZone } = await supabaseAdmin
    .from('schools').select('zone_id').eq('id', effectiveSchoolId).single()
  const zoneId = schoolZone?.zone_id || 2

  const sysSettings = await getSettingsForZone(zoneId)
  const schoolYear = (sysSettings.active_school_year || sysSettings.school_year || '115') as string

  const [
    { data: school },
    { data: amounts },
    { data: bank1 },
    { data: settle1 },
    { data: settle2 },
    { data: allChangeRequests },
    { data: profileRow },
    { data: plans },
    { data: planAmountRows },
    { data: planSettlements },
  ] = await Promise.all([
    supabaseAdmin.from('schools').select('id, code, district, name').eq('id', effectiveSchoolId).single(),
    supabaseAdmin.from('school_amounts').select('sem1_amount, sem2_amount, approved_total').eq('school_id', effectiveSchoolId).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('bank_accounts').select('confirmed_at, is_modified').eq('school_id', effectiveSchoolId).eq('semester', 1).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('settlements').select('status, scan_file_path, total_expense, surplus, repay_amount, business_expense').eq('school_id', effectiveSchoolId).eq('semester', 1).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('settlements').select('status, scan_file_path, remittance_file_path, total_expense, surplus, repay_amount, business_expense').eq('school_id', effectiveSchoolId).eq('semester', 2).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('change_requests')
      .select('id, semester, plan_id, request_type, status, reviewed_at')
      .eq('school_id', effectiveSchoolId)
      .eq('school_year', schoolYear)
      .order('reviewed_at', { ascending: false }),
    // 模擬身分時改用學校 school_id 查詢承辦人資訊，否則用 email
    impersonate
      ? supabaseAdmin.from('user_profiles').select('contact_name, contact_title, contact_phone').eq('school_id', effectiveSchoolId).eq('is_admin', false).maybeSingle()
      : supabaseAdmin.from('user_profiles').select('contact_name, contact_title, contact_phone').eq('email', session.user.email).maybeSingle(),
    supabaseAdmin.from('plans').select('*').eq('school_year', schoolYear).eq('is_active', true).order('sort_order'),
    supabaseAdmin.from('plan_amounts').select('plan_id, semester, amount').eq('school_id', effectiveSchoolId).eq('school_year', schoolYear),
    supabaseAdmin.from('settlements').select('plan_id, semester, status, scan_file_path, remittance_file_path, total_expense, surplus, repay_amount').eq('school_id', effectiveSchoolId).eq('school_year', schoolYear).not('plan_id', 'is', null),
  ])

  const pendingRequests = (allChangeRequests || []).filter(r => r.status === 'pending')
  const recentReviewed = (allChangeRequests || []).filter(r => r.status === 'approved' || r.status === 'rejected')

  const hasPending = (sem: number, types: string[]) =>
    pendingRequests.some(r => r.semester === sem && types.includes(r.request_type))
  const hasPendingByPlan = (planId: string, sem: number, types: string[]) =>
    pendingRequests.some(r => r.plan_id === planId && r.semester === sem && types.includes(r.request_type))

  const contactName = profileRow?.contact_name || ''
  const contactTitle = profileRow?.contact_title || ''
  const contactPhone = profileRow?.contact_phone || ''

  const settings = { ...SETTINGS_DEFAULTS, ...sysSettings }

  const sem1Expense = settle1?.total_expense ?? settle1?.business_expense ?? 0
  const sem1Surplus = settle1?.surplus ?? 0
  const sem1Repay = settle1?.repay_amount ?? 0
  const sem2Approved = amounts?.sem2_amount || 0
  const sem2Net = sem2Approved - sem1Repay
  const sem2Expense = settle2?.total_expense ?? settle2?.business_expense ?? 0
  const sem2Surplus = settle2?.surplus ?? 0
  const sem2Repay = settle2?.repay_amount ?? 0

  // plan_id+semester -> amount
  const planAmountMap: Record<string, Record<number, number>> = {}
  let planAmountTotal = 0
  const activePlanIds = new Set((plans || []).filter(p => p.is_active).map(p => p.id))
  for (const pa of (planAmountRows || [])) {
    if (!planAmountMap[pa.plan_id]) planAmountMap[pa.plan_id] = {}
    planAmountMap[pa.plan_id][(pa as { plan_id: string; semester: number; amount: number }).semester ?? 1] = pa.amount
    if (activePlanIds.has(pa.plan_id)) planAmountTotal += pa.amount || 0
  }
  // 核定總金額 = 基本免費午餐 + 所有計畫核定金額
  const grandTotal = (amounts?.approved_total || 0) + planAmountTotal
  // 只顯示有核定金額的計畫（第4點）
  const visiblePlans = (plans || []).filter(plan => {
    const sems = plan.semester == null ? [1, 2] : [plan.semester ?? 1]
    return sems.some(s => (planAmountMap[plan.id]?.[s] ?? 0) > 0)
  })
  const hasPlans = visiblePlans.length > 0
  // plan_id -> label (for notifications)
  const planLabelMap: Record<string, string> = {}
  for (const p of (plans || [])) planLabelMap[p.id] = p.label  // 通知仍需全部 plan
  // plan_id or plan_id_semester -> settlement
  type PlanSettle = { plan_id: string | null; status: string | null; scan_file_path: string | null; remittance_file_path: string | null; total_expense: number | null; surplus: number | null; repay_amount: number | null; semester?: number | null }
  const planSettleMap: Record<string, PlanSettle> = {}
  for (const ps of (planSettlements || [])) {
    if (ps.plan_id) {
      planSettleMap[ps.plan_id] = ps
      if (ps.semester) planSettleMap[`${ps.plan_id}_${ps.semester}`] = ps
    }
  }

  const colors = ['blue', 'indigo', 'sky', 'violet', 'teal'] as const
  type Color = typeof colors[number]

  return (
    <div className="min-h-screen bg-gray-50">
      {impersonate && <ImpersonateBanner schoolName={impersonate.school_name || school?.name || ''} />}
      <Navbar schoolName={school?.name} email={session.user.email} isAdmin={session.user.is_admin} schoolYear={schoolYear} systemName={sysSettings.system_name} manualUrl={sysSettings.manual_url} currentPage="school" />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {/* 審核結果通知 */}
        {recentReviewed && recentReviewed.length > 0 && (
          <ReviewNotifications notifications={recentReviewed as { id: string; semester: number; plan_id?: string | null; request_type: string; status: 'approved' | 'rejected'; reviewed_at: string }[]} planLabelMap={planLabelMap} />
        )}

        {/* 學校資訊卡 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{schoolYear} 學年度・{school?.district}・編號 {school?.code}</p>
              <h1 className="text-2xl font-bold text-gray-800 mt-0.5">{school?.name}</h1>
              {(contactName || contactPhone) && (
                <p className="text-xs text-gray-400 mt-1">
                  承辦人：{contactName}{contactTitle ? `（${contactTitle}）` : ''}
                  {contactPhone ? `　${contactPhone}` : ''}
                </p>
              )}
            </div>
            <div className="text-right text-sm text-gray-500 space-y-1">
              <p>核定總金額</p>
              <p className="text-xl font-bold text-blue-700">NT$ {formatAmount(grandTotal)}</p>
              <div className="flex gap-2 justify-end mt-1">
                <ContactEditButton initialName={contactName} initialTitle={contactTitle} initialPhone={contactPhone} />
                <RebindButton />
              </div>
            </div>
          </div>

          {/* 金額摘要 */}
          {hasPlans ? (
            /* 計畫模式：每個計畫一張小卡（全學年計畫展開成兩張） */
            <div className="space-y-3">
              {visiblePlans.map((plan, i) => {
                const isFullYear = plan.semester == null
                const color = colors[i % colors.length]
                const colorMap: Record<Color, string> = {
                  blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600',
                  sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600', teal: 'bg-teal-50 text-teal-600',
                }
                const amtColorMap: Record<Color, string> = {
                  blue: 'text-blue-700', indigo: 'text-indigo-700', sky: 'text-sky-700', violet: 'text-violet-700', teal: 'text-teal-700',
                }
                const sems: number[] = isFullYear ? [1, 2] : [plan.semester ?? 1]
                // 嚴格用 planId_sem 查，不做 fallback，避免 sem2 拿到 sem1 的資料
                const getSettle = (sem: number) => planSettleMap[`${plan.id}_${sem}`]
                // 動態計算S1結餘（用於全學年扣抵顯示）
                const s1Approved = planAmountMap[plan.id]?.[1] || 0
                const s1Expense = getSettle(1)?.total_expense || 0
                // 只有S1已填實支金額，才計算結餘及顯示扣抵
                const s1Repay = (s1Approved > 0 && s1Expense > 0) ? Math.max(0, Math.ceil(s1Approved - s1Expense)) : 0
                return (
                  <div key={plan.id}>
                    <p className="text-xs font-semibold text-gray-500 mb-2">{plan.name}</p>
                    <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${sems.length}, 1fr)` }}>
                      {sems.map(sem => {
                        const approved = planAmountMap[plan.id]?.[sem] || 0
                        const settle = getSettle(sem)
                        const expense = settle?.total_expense || 0
                        // 動態計算結餘，不依賴 DB 儲存的 surplus（可能因舊 bug 有誤）
                        const surplus = approved > 0 ? approved - expense : (settle?.surplus || 0)
                        const repay = surplus > 0 ? Math.ceil(surplus) : 0
                        const s2net = sem === 2 && isFullYear && plan.deduct_s1_repay ? approved - s1Repay : null
                        return (
                          <div key={sem} className={`rounded-xl p-3.5 space-y-1.5 ${colorMap[color]}`}>
                            <p className="text-xs font-bold uppercase tracking-wide">{isFullYear ? `第${sem}學期` : plan.label}</p>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">核定金額</span>
                              <span className={`font-bold ${amtColorMap[color]}`}>NT$ {formatAmount(approved)}</span>
                            </div>
                            {s2net !== null && s1Repay > 0 && (
                              <div className="text-xs bg-orange-50 text-orange-600 rounded px-2 py-1">
                                扣第1學期結餘 NT$ {formatAmount(s1Repay)}<br />
                                <span className="font-semibold">淨撥款：NT$ {formatAmount(s2net)}</span>
                              </div>
                            )}
                            {expense > 0 && (
                              <>
                                <div className="flex justify-between text-xs border-t border-white/50 pt-1.5">
                                  <span className="text-gray-500">實支金額</span>
                                  <span className="text-gray-700">NT$ {formatAmount(expense)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">{surplus >= 0 ? '結餘款' : '超支'}</span>
                                  <span className={surplus >= 0 ? 'text-orange-600 font-semibold' : 'text-green-600 font-semibold'}>NT$ {formatAmount(Math.abs(surplus))}</span>
                                </div>
                                {repay > 0 && !(plan.deduct_s1_repay && sem === 1) && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">應繳回</span>
                                    <span className="text-red-600 font-semibold">NT$ {formatAmount(repay)}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* 學期模式（原本） */
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">第1學期</p>
                <AmountRow label="核定金額" amount={amounts?.sem1_amount || 0} color="blue" bold />
                {sem1Expense > 0 && (
                  <div className="border-t border-blue-100 pt-1.5 space-y-1">
                    <AmountRow label="實支金額" amount={sem1Expense} color="blue" />
                    <AmountRow label={sem1Surplus >= 0 ? '結餘款' : '超支'} amount={Math.abs(sem1Surplus)} color={sem1Surplus > 0 ? 'orange' : 'green'} />
                  </div>
                )}
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 space-y-1.5">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">第2學期</p>
                <AmountRow label="核定金額" amount={sem2Approved} color="indigo" bold />
                {sem1Repay > 0 && (
                  <div className="text-xs text-orange-600 bg-orange-50 rounded-lg px-2 py-1">
                    扣第1學期結餘 NT$ {formatAmount(sem1Repay)}<br />
                    <span className="font-semibold">淨撥款：NT$ {formatAmount(sem2Net)}</span>
                  </div>
                )}
                {sem2Expense > 0 && (
                  <div className="border-t border-indigo-100 pt-1.5 space-y-1">
                    <AmountRow label="實支金額" amount={sem2Expense} color="indigo" />
                    <AmountRow label={sem2Surplus >= 0 ? '結餘款' : '超支'} amount={Math.abs(sem2Surplus)} color={sem2Surplus > 0 ? 'orange' : 'green'} />
                    {sem2Repay > 0 && <AmountRow label="應繳回" amount={sem2Repay} color="red" />}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 期程卡片 */}
        {hasPlans ? (
          /* 計畫模式：每個計畫一張期程卡 */
          <>
            {/* 學期初帳戶變更（block1_open=true 才顯示） */}
            {settings.block1_open !== 'false' && (
              <PeriodCard
                label="帳戶資訊變更"
                color="blue"
                deadline={settings.block1_deadline || '請洽區承辦確認'}
                disabled={false}
                steps={[{
                  label: '帳戶資訊變更申請',
                  done: false,
                  href: '/school/account-change',
                  desc: '如需修改匯款帳戶資訊，請點此送出申請',
                  optional: true,
                }]}
              />
            )}
            {visiblePlans.map((plan, i) => {
              const isFullYear = plan.semester == null
              const sems = isFullYear ? [1, 2] : [plan.semester ?? 1]
              return sems.map(sem => {
                const settle = planSettleMap[`${plan.id}_${sem}`] || (isFullYear ? null : planSettleMap[plan.id])
                const open = plan.is_open ?? false
                const deadlineText = plan.deadline || plan.open_note || (open ? '開放中' : '尚未開放')
                const label = isFullYear ? `${plan.label}・第${sem}學期` : plan.label
                const steps = [
                  {
                    label: '填寫實支金額並下載經費收支結算表',
                    done: !!settle?.status && settle.status !== 'draft',
                    href: `/school/semester/${sem}/settlement?plan_id=${plan.id}`,
                    desc: settle?.status === 'uploaded' ? '已上傳結算表' : settle?.status === 'downloaded' ? '已下載，請列印蓋章後上傳' : '請輸入實支總額並下載結算表',
                  },
                  {
                    label: '上傳經費收支結算表掃描檔',
                    done: !!settle?.scan_file_path && !hasPendingByPlan(plan.id, sem, ['scan_upload', 'scan_reupload']),
                    pending: hasPendingByPlan(plan.id, sem, ['scan_upload', 'scan_reupload']),
                    href: `/school/semester/${sem}/upload?plan_id=${plan.id}`,
                    desc: hasPendingByPlan(plan.id, sem, ['scan_upload', 'scan_reupload']) ? '待審核中，請靜候通知' : settle?.scan_file_path ? '✓ 已核准' : '請上傳列印蓋章後的掃描檔',
                  },
                  ...(plan.require_repay && !(plan.deduct_s1_repay && sem === 1) ? [{
                    label: '上傳賸餘款送款憑單',
                    done: !!settle?.remittance_file_path && !hasPendingByPlan(plan.id, sem, ['remittance_upload', 'remittance_reupload']),
                    pending: hasPendingByPlan(plan.id, sem, ['remittance_upload', 'remittance_reupload']),
                    href: `/school/semester/${sem}/remittance?plan_id=${plan.id}`,
                    desc: hasPendingByPlan(plan.id, sem, ['remittance_upload', 'remittance_reupload']) ? '待審核中，請靜候通知' : settle?.remittance_file_path ? '✓ 已核准' : (settle?.surplus ?? 0) > 0 ? '有賸餘款，請繳款後上傳憑單' : '如有賸餘款，繳回公庫後上傳送款憑單',
                  }] : []),
                ]
                return (
                  <PeriodCard
                    key={`${plan.id}_${sem}`}
                    label={label}
                    color={(['blue', 'sky', 'indigo'] as const)[i % 3]}
                    deadline={deadlineText}
                    disabled={!open}
                    steps={steps}
                  />
                )
              })
            })}
          </>
        ) : (
          /* 學期模式（原本） */
          <>
            <PeriodCard
              label="第1學期初"
              color="blue"
              deadline={settings.block1_deadline || '請洽承辦確認'}
              disabled={settings.block1_open === 'false'}
              steps={[{
                label: '帳戶資訊變更申請',
                done: false,
                href: '/school/account-change',
                desc: '如需修改匯款帳戶資訊，請點此送出申請',
                optional: true,
              }]}
            />
            <PeriodCard
              label="第1學期末"
              color="sky"
              deadline={`結算截止：${settings.block2_deadline}`}
              disabled={settings.block2_open === 'false'}
              steps={[
                {
                  label: '填寫實支金額並下載經費收支結算表',
                  done: !!settle1?.status && settle1.status !== 'draft',
                  href: '/school/semester/1/settlement',
                  desc: settle1?.status === 'uploaded' ? '已上傳結算表' : settle1?.status === 'downloaded' ? '已下載，請列印蓋章後上傳' : '請輸入實支總額並下載結算表',
                },
                {
                  label: '上傳經費收支結算表掃描檔',
                  done: !!settle1?.scan_file_path && !hasPending(1, ['scan_upload', 'scan_reupload']),
                  pending: hasPending(1, ['scan_upload', 'scan_reupload']),
                  href: '/school/semester/1/upload',
                  desc: hasPending(1, ['scan_upload', 'scan_reupload']) ? '待審核中，請靜候通知' : settle1?.scan_file_path ? '✓ 已核准' : '請上傳列印蓋章後的掃描檔',
                },
              ]}
            />
            <PeriodCard
              label="第2學期末"
              color="indigo"
              deadline={`截止：${settings.block3_deadline}`}
              disabled={settings.block3_open === 'false'}
              steps={[
                {
                  label: '填寫實支金額並下載經費收支結算表',
                  done: !!settle2?.status && settle2.status !== 'draft',
                  href: '/school/semester/2/settlement',
                  desc: settle2?.status === 'uploaded' ? '已上傳結算表' : settle2?.status === 'downloaded' ? '已下載，請列印蓋章後上傳' : '請輸入實支總額並下載結算表',
                },
                {
                  label: '上傳經費收支結算表掃描檔',
                  done: !!settle2?.scan_file_path && !hasPending(2, ['scan_upload', 'scan_reupload']),
                  pending: hasPending(2, ['scan_upload', 'scan_reupload']),
                  href: '/school/semester/2/upload',
                  desc: hasPending(2, ['scan_upload', 'scan_reupload']) ? '待審核中，請靜候通知' : settle2?.scan_file_path ? '✓ 已核准' : '請上傳列印蓋章後的掃描檔',
                },
                {
                  label: '上傳賸餘款送款憑單',
                  done: !!settle2?.remittance_file_path && !hasPending(2, ['remittance_upload', 'remittance_reupload']),
                  pending: hasPending(2, ['remittance_upload', 'remittance_reupload']),
                  href: '/school/semester/2/remittance',
                  desc: hasPending(2, ['remittance_upload', 'remittance_reupload']) ? '待審核中，請靜候通知' : settle2?.remittance_file_path ? '✓ 已核准' : (settle2?.surplus ?? 0) > 0 ? '有賸餘款，請繳款後上傳憑單' : '如有賸餘款，繳回公庫後上傳送款憑單',
                },
              ]}
            />
          </>
        )}
        {/* 區承辦聯絡資訊 */}
        {(sysSettings.host_school || sysSettings.admin_name || sysSettings.admin_phone) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">區承辦聯絡</p>
            <div className="space-y-1 text-sm text-gray-700">
              {sysSettings.host_school && (
                <p className="font-medium">{sysSettings.host_school}</p>
              )}
              {(sysSettings.admin_name || sysSettings.admin_title) && (
                <p className="text-gray-500 text-xs">
                  {sysSettings.admin_name}
                  {sysSettings.admin_title ? `（${sysSettings.admin_title}）` : ''}
                </p>
              )}
              {sysSettings.admin_phone && (
                <a href={`tel:${sysSettings.admin_phone}`}
                  className="text-blue-600 text-xs hover:underline block">
                  📞 {sysSettings.admin_phone}
                </a>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function AmountRow({ label, amount, color, bold }: {
  label: string; amount: number; color: string; bold?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-700', indigo: 'text-indigo-700',
    orange: 'text-orange-600', red: 'text-red-600', green: 'text-green-600',
  }
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold' : ''} ${colorMap[color] || 'text-gray-700'}`}>NT$ {formatAmount(amount)}</span>
    </div>
  )
}

function PeriodCard({ label, color, deadline, disabled, steps }: {
  label: string
  color: 'blue' | 'sky' | 'indigo'
  deadline: string
  disabled?: boolean
  steps: { label: string; done: boolean; pending?: boolean; href: string; desc: string; optional?: boolean }[]
}) {
  const headerColor = {
    blue: disabled ? 'bg-gray-400' : 'bg-blue-600',
    sky: disabled ? 'bg-gray-400' : 'bg-sky-500',
    indigo: disabled ? 'bg-gray-400' : 'bg-indigo-600',
  }[color]

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className={`flex items-center justify-between ${headerColor} text-white text-sm font-bold px-4 py-2 rounded-t-xl`}>
        <span>{label}</span>
        <span className="text-xs font-normal opacity-80">{disabled ? '暫未開放' : deadline}</span>
      </div>
      <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        {disabled ? (
          <p className="text-sm text-gray-400 text-center py-2">此階段尚未開放，請等待通知</p>
        ) : (
          steps.map((step, i) => (
            <Link key={i} href={step.href}
              className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                ${step.optional ? 'bg-blue-100 text-blue-500'
                  : step.done ? 'bg-green-500 text-white'
                  : step.pending ? 'bg-amber-400 text-white'
                  : 'bg-gray-200 text-gray-600'}`}>
                {step.optional ? '✎' : step.done ? '✓' : step.pending ? '⏳' : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{step.label}</p>
                <p className="text-xs text-gray-500 truncate">{step.desc}</p>
              </div>
              <span className="text-gray-400 group-hover:text-blue-500 transition-colors text-sm">→</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
