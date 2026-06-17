import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { formatAmount } from '@/lib/utils'

export default async function SchoolDashboard() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')
  if (!session.user.school_id) redirect('/bind-school')

  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('*')
    .eq('id', session.user.school_id)
    .single()

  const { data: bank1 } = await supabaseAdmin
    .from('bank_accounts')
    .select('confirmed_at, is_modified')
    .eq('school_id', session.user.school_id)
    .eq('semester', 1)
    .single()

  const { data: bank2 } = await supabaseAdmin
    .from('bank_accounts')
    .select('confirmed_at, is_modified')
    .eq('school_id', session.user.school_id)
    .eq('semester', 2)
    .single()

  const { data: settle1 } = await supabaseAdmin
    .from('settlements')
    .select('status, scan_file_path')
    .eq('school_id', session.user.school_id)
    .eq('semester', 1)
    .single()

  const { data: settle2 } = await supabaseAdmin
    .from('settlements')
    .select('status, scan_file_path, remittance_file_path')
    .eq('school_id', session.user.school_id)
    .eq('semester', 2)
    .single()

  function StatusBadge({ done, label }: { done: boolean; label: string }) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${done ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
        {done ? '✓' : '○'} {label}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        schoolName={school?.name}
        email={session.user.email}
        isAdmin={session.user.is_admin}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* 學校資訊卡 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">{school?.district}・編號 {school?.code}</p>
              <h1 className="text-2xl font-bold text-gray-800 mt-0.5">{school?.name}</h1>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>核定總金額</p>
              <p className="text-xl font-bold text-blue-700">NT$ {formatAmount(school?.approved_total || 0)}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500">第1學期核定</p>
              <p className="font-bold text-blue-700">NT$ {formatAmount(school?.sem1_amount || 0)}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xs text-indigo-500">第2學期核定</p>
              <p className="font-bold text-indigo-700">NT$ {formatAmount(school?.sem2_amount || 0)}</p>
            </div>
          </div>
        </div>

        {/* 第1學期 */}
        <SemesterCard
          sem={1}
          bankConfirmed={!!bank1?.confirmed_at}
          settlementStatus={settle1?.status}
          scanUploaded={!!settle1?.scan_file_path}
        />

        {/* 第2學期 */}
        <SemesterCard
          sem={2}
          bankConfirmed={!!bank2?.confirmed_at}
          settlementStatus={settle2?.status}
          scanUploaded={!!settle2?.scan_file_path}
          remittanceUploaded={!!settle2?.remittance_file_path}
        />
      </main>
    </div>
  )
}

function SemesterCard({
  sem, bankConfirmed, settlementStatus, scanUploaded, remittanceUploaded
}: {
  sem: 1 | 2
  bankConfirmed: boolean
  settlementStatus?: string
  scanUploaded: boolean
  remittanceUploaded?: boolean
}) {
  const color = sem === 1 ? 'blue' : 'indigo'
  const steps = [
    {
      label: '帳戶資訊確認',
      done: bankConfirmed,
      href: `/school/semester/${sem}/bank`,
      desc: bankConfirmed ? '已確認' : '請填寫並確認匯款帳戶資訊',
    },
    {
      label: '填寫實支金額',
      done: !!settlementStatus && settlementStatus !== 'draft',
      href: `/school/semester/${sem}/settlement`,
      desc: settlementStatus === 'uploaded' ? '已上傳結算表' : settlementStatus === 'downloaded' ? '已下載，請列印蓋章後上傳' : '請輸入實支總額並下載結算表',
    },
    {
      label: '上傳結算表掃描檔',
      done: scanUploaded,
      href: `/school/semester/${sem}/upload`,
      desc: scanUploaded ? '已上傳' : '請上傳列印蓋章後的掃描檔',
    },
    ...(sem === 2 ? [{
      label: '上傳送款憑單（有賸餘款時）',
      done: !!remittanceUploaded,
      href: `/school/semester/2/remittance`,
      desc: remittanceUploaded ? '已上傳' : '繳回公庫後上傳送款憑單掃描檔',
    }] : []),
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className={`bg-${color}-600 text-white px-6 py-3 flex items-center justify-between`}>
        <h2 className="font-bold">第 {sem} 學期</h2>
        <span className="text-xs opacity-80">
          {sem === 1 ? '結算截止：116.2.15' : '學期末截止'}
        </span>
      </div>
      <div className="p-6 space-y-3">
        {steps.map((step, i) => (
          <Link
            key={i}
            href={step.href}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all group"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {step.done ? '✓' : i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800">{step.label}</p>
              <p className="text-sm text-gray-500 truncate">{step.desc}</p>
            </div>
            <span className="text-gray-400 group-hover:text-blue-500 transition-colors">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
