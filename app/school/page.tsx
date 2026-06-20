import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getSystemSettings } from '@/lib/settings'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { formatAmount } from '@/lib/utils'
import RebindButton from '@/components/RebindButton'
import ContactEditButton from '@/components/ContactEditButton'

function contactPath(email: string) {
  const safe = email.replace('@', '_at_').replace(/\./g, '_')
  return `__contacts/${safe}.json`
}

const SETTINGS_DEFAULTS = {
  block1_open: 'true', block1_deadline: '115學年度開學後',
  block2_open: 'true', block2_deadline: '2026-02-15',
  block3_open: 'false', block3_deadline: '2026-06-30',
}

export default async function SchoolDashboard() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')
  if (!session.user.school_id) redirect('/bind-school')

  const [schoolYear, sysSettings] = await Promise.all([getActiveSchoolYear(), getSystemSettings()])

  const [
    { data: school },
    { data: amounts },
    { data: bank1 },
    { data: settle1 },
    { data: settle2 },
    { data: pendingRequests },
  ] = await Promise.all([
    supabaseAdmin.from('schools').select('id, code, district, name').eq('id', session.user.school_id).single(),
    supabaseAdmin.from('school_amounts').select('sem1_amount, sem2_amount, approved_total').eq('school_id', session.user.school_id).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('bank_accounts').select('confirmed_at, is_modified').eq('school_id', session.user.school_id).eq('semester', 1).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('settlements').select('status, scan_file_path, total_expense, surplus, repay_amount, business_expense').eq('school_id', session.user.school_id).eq('semester', 1).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('settlements').select('status, scan_file_path, remittance_file_path, total_expense, surplus, repay_amount, business_expense').eq('school_id', session.user.school_id).eq('semester', 2).eq('school_year', schoolYear).single(),
    supabaseAdmin.from('change_requests').select('semester, request_type, status').eq('school_id', session.user.school_id).eq('school_year', schoolYear).eq('status', 'pending'),
  ])

  const hasPending = (sem: number, types: string[]) =>
    (pendingRequests || []).some(r => r.semester === sem && types.includes(r.request_type))

  // Read contact info from Storage
  let contactName = ''
  let contactTitle = ''
  let contactPhone = ''
  try {
    const { data: contactBlob } = await supabaseAdmin.storage
      .from('settlement-files')
      .download(contactPath(session.user.email))
    if (contactBlob) {
      const parsed = JSON.parse(await contactBlob.text())
      contactName = parsed.contact_name || ''
      contactTitle = parsed.contact_title || ''
      contactPhone = parsed.contact_phone || ''
    }
  } catch {
    // contact not set yet
  }

  // Use system settings for block open/deadline
  const settings = { ...SETTINGS_DEFAULTS, ...sysSettings }

  const block1Open = settings.block1_open === 'true'
  const block2Open = settings.block2_open === 'true'
  const block3Open = settings.block3_open === 'true'

  const sem1Expense = settle1?.total_expense ?? settle1?.business_expense ?? 0
  const sem1Surplus = settle1?.surplus ?? 0
  const sem1Repay = settle1?.repay_amount ?? 0

  const sem2Approved = amounts?.sem2_amount || 0
  const sem2Net = sem2Approved - sem1Repay
  const sem2Expense = settle2?.total_expense ?? settle2?.business_expense ?? 0
  const sem2Surplus = settle2?.surplus ?? 0
  const sem2Repay = settle2?.repay_amount ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar schoolName={school?.name} email={session.user.email} isAdmin={session.user.is_admin} schoolYear={schoolYear} systemName={sysSettings.system_name} manualUrl={sysSettings.manual_url} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
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
              <p className="text-xl font-bold text-blue-700">NT$ {formatAmount(amounts?.approved_total || 0)}</p>
              <div className="flex gap-2 justify-end mt-1">
                <ContactEditButton initialName={contactName} initialTitle={contactTitle} initialPhone={contactPhone} />
                <RebindButton />
              </div>
            </div>
          </div>

          {/* 學期金額摘要卡 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 第1學期 */}
            <div className="bg-blue-50 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">第1學期</p>
              <AmountRow label="核定金額" amount={amounts?.sem1_amount || 0} color="blue" bold />
              {sem1Expense > 0 && (
                <>
                  <div className="border-t border-blue-100 pt-1.5 space-y-1">
                    <AmountRow label="實支金額" amount={sem1Expense} color="blue" />
                    <AmountRow
                      label={sem1Surplus >= 0 ? '結餘款' : '超支'}
                      amount={Math.abs(sem1Surplus)}
                      color={sem1Surplus > 0 ? 'orange' : 'green'}
                    />
                  </div>
                </>
              )}
            </div>

            {/* 第2學期 */}
            <div className="bg-indigo-50 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">第2學期</p>
              <AmountRow label="核定金額" amount={sem2Approved} color="indigo" bold />
              {sem1Repay > 0 && (
                <div className="text-xs text-orange-600 bg-orange-50 rounded-lg px-2 py-1">
                  扣第1學期結餘 NT$ {formatAmount(sem1Repay)}
                  <br />
                  <span className="font-semibold">淨撥款：NT$ {formatAmount(sem2Net)}</span>
                </div>
              )}
              {sem2Expense > 0 && (
                <div className="border-t border-indigo-100 pt-1.5 space-y-1">
                  <AmountRow label="實支金額" amount={sem2Expense} color="indigo" />
                  <AmountRow
                    label={sem2Surplus >= 0 ? '結餘款' : '超支'}
                    amount={Math.abs(sem2Surplus)}
                    color={sem2Surplus > 0 ? 'orange' : 'green'}
                  />
                  {sem2Repay > 0 && (
                    <AmountRow label="應繳回" amount={sem2Repay} color="red" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 第1學期初 */}
        <PeriodCard
          label="第1學期初"
          color="blue"
          deadline={settings.block1_deadline}
          disabled={!block1Open}
          steps={[
            {
              label: '帳戶資訊變更申請',
              done: false,
              href: '/school/account-change',
              desc: '如需修改匯款帳戶資訊，請點此送出申請',
              optional: true,
            },
          ]}
        />

        {/* 第1學期末 */}
        <PeriodCard
          label="第1學期末"
          color="sky"
          deadline={`結算截止：${settings.block2_deadline}`}
          disabled={!block2Open}
          steps={[
            {
              label: '填寫實支金額並下載經費收支結算表',
              done: !!settle1?.status && settle1.status !== 'draft',
              href: '/school/semester/1/settlement',
              desc: settle1?.status === 'uploaded' ? '已上傳結算表' : settle1?.status === 'downloaded' ? '已下載，請列印蓋章後上傳' : '請輸入實支總額並下載結算表',
            },
            {
              label: '上傳經費收支結算表掃描檔',
              done: !!settle1?.scan_file_path,
              href: '/school/semester/1/upload',
              desc: hasPending(1, ['scan_upload', 'scan_reupload']) ? '⏳ 待審核中，請靜候通知' : settle1?.scan_file_path ? '✓ 已核准' : '請上傳列印蓋章後的掃描檔',
            },
          ]}
        />

        {/* 第2學期末 */}
        <PeriodCard
          label="第2學期末"
          color="indigo"
          deadline={`截止：${settings.block3_deadline}`}
          disabled={!block3Open}
          steps={[
            {
              label: '填寫實支金額並下載經費收支結算表',
              done: !!settle2?.status && settle2.status !== 'draft',
              href: '/school/semester/2/settlement',
              desc: settle2?.status === 'uploaded' ? '已上傳結算表' : settle2?.status === 'downloaded' ? '已下載，請列印蓋章後上傳' : '請輸入實支總額並下載結算表',
            },
            {
              label: '上傳經費收支結算表掃描檔',
              done: !!settle2?.scan_file_path,
              href: '/school/semester/2/upload',
              desc: hasPending(2, ['scan_upload', 'scan_reupload']) ? '⏳ 待審核中，請靜候通知' : settle2?.scan_file_path ? '✓ 已核准' : '請上傳列印蓋章後的掃描檔',
            },
            {
              label: '上傳賸餘款送款憑單',
              done: !!settle2?.remittance_file_path,
              href: '/school/semester/2/remittance',
              desc: hasPending(2, ['remittance_upload', 'remittance_reupload']) ? '⏳ 待審核中，請靜候通知' : settle2?.remittance_file_path ? '✓ 已核准' : (settle2?.surplus ?? 0) > 0 ? '有賸餘款，請繳款後上傳憑單' : '如有賸餘款，繳回公庫後上傳送款憑單',
            },
          ]}
        />
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
  const cls = `text-xs ${bold ? 'font-bold' : ''} ${colorMap[color] || 'text-gray-700'}`
  return (
    <div className="flex justify-between items-baseline">
      <span className={`text-xs text-gray-500`}>{label}</span>
      <span className={cls}>NT$ {formatAmount(amount)}</span>
    </div>
  )
}

function PeriodCard({ label, color, deadline, disabled, steps }: {
  label: string
  color: 'blue' | 'sky' | 'indigo'
  deadline: string
  disabled?: boolean
  steps: { label: string; done: boolean; href: string; desc: string; optional?: boolean }[]
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
        <span className="text-xs font-normal opacity-80">
          {disabled ? '暫未開放' : deadline}
        </span>
      </div>
      <div className="bg-white rounded-b-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        {disabled ? (
          <p className="text-sm text-gray-400 text-center py-2">此階段尚未開放，請等待通知</p>
        ) : (
          steps.map((step, i) => (
            <Link key={i} href={step.href}
              className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${step.optional ? 'bg-blue-100 text-blue-500' : step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {step.optional ? '✎' : step.done ? '✓' : i + 1}
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
