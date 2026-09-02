'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { formatAmount } from '@/lib/utils'
import { Spinner, BlockSpinner } from '@/components/Spinner'
import type { School, AmountRow, BankRow, SettleRow, ProfileRow, ContactInfo } from './types'

// 動態載入較重的頁籤，減少初始 JS bundle
const SchoolsTab = dynamic(() => import('./tabs/SchoolsTab'), { loading: () => <BlockSpinner /> })
const SchoolMgmtTab = dynamic(() => import('./tabs/SchoolMgmtTab'), { loading: () => <BlockSpinner /> })
const AccountsTab = dynamic(() => import('./tabs/AccountsTab'), { loading: () => <BlockSpinner /> })
const SettingsTab = dynamic(() => import('./tabs/SettingsTab'), { loading: () => <BlockSpinner /> })
const ZonesTab = dynamic(() => import('./tabs/ZonesTab'), { loading: () => <BlockSpinner /> })

type Tab = 'overview' | 'review' | 'accounts' | 'schools' | 'school_mgmt' | 'settings' | 'zones'

export interface Plan {
  id: string; name: string; label: string; semester: number | null
  require_repay: boolean; deduct_s1_repay: boolean; sort_order: number; is_active: boolean
  deadline: string; school_year: string
}
export interface PlanAmount { school_id: number; plan_id: string; semester: number; amount: number }

export default function AdminDashboardClient({
  schools, amounts, banks, settlements, profiles, contacts, currentUserEmail, activeSchoolYear, plans, planAmounts, adminManualUrl, userRole
}: {
  schools: School[]; amounts: AmountRow[]; banks: BankRow[]; settlements: SettleRow[]
  profiles: ProfileRow[]; contacts: Record<string, ContactInfo>
  currentUserEmail: string; activeSchoolYear: string
  plans: Plan[]; planAmounts: PlanAmount[]
  adminManualUrl?: string
  userRole?: string
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [pendingCount, setPendingCount] = useState(0)
  const [overviewKey, setOverviewKey] = useState(0)
  const [tabKeys, setTabKeys] = useState<Record<string, number>>({ review: 0, accounts: 0, schools: 0, school_mgmt: 0, settings: 0 })
  const [refreshing, setRefreshing] = useState(false)
  // 總覽的 settlements/planAmounts/plans 可在重新整理時重新取得
  const [liveSettlements, setLiveSettlements] = useState<SettleRow[]>(settlements)
  const [livePlanAmounts, setLivePlanAmounts] = useState<PlanAmount[]>(planAmounts)
  const [livePlans, setLivePlans] = useState<Plan[]>(plans)

  function reloadPlans() {
    fetch(`/api/admin/plans?school_year=${activeSchoolYear}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLivePlans(d) })
      .catch(() => {})
  }
  const [driveRootFolderId, setDriveRootFolderId] = useState('')
  const [driveRootFolderUrl, setDriveRootFolderUrl] = useState('')
  const [rootInitingFolders, setRootInitingFolders] = useState(false)

  async function handleInitFolders() {
    if (!confirm('將在 Google Drive 根資料夾下，為所有分區建立本學年度的子資料夾，確定執行？')) return
    setRootInitingFolders(true)
    const res = await fetch('/api/admin/init-drive-folders', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setRootInitingFolders(false)
    if (d.ok) alert(`資料夾建立完成：\n${(d.paths as string[]).join('\n')}`)
    else alert(d.error || '建立失敗')
  }
  const [showImpersonate, setShowImpersonate] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [impersonateSearch, setImpersonateSearch] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/account-changes').then(r => r.json()).catch(() => []),
      fetch('/api/admin/change-requests').then(r => r.json()).catch(() => []),
    ]).then(([ac, cr]) => {
      const count = (Array.isArray(ac) ? ac.filter((r: { status: string }) => r.status === 'pending').length : 0) +
                    (Array.isArray(cr) ? cr.filter((r: { status: string }) => r.status === 'pending').length : 0)
      setPendingCount(count)
    })
  }, [tab])

  const isSuperAdmin = userRole === 'super_admin'
  const isZoneAdmin = userRole === 'zone_admin' || isSuperAdmin

  const TAB_LABELS: Record<Tab, string> = {
    overview: '📊 總覽', review: '✅ 申請審核', accounts: '👤 帳號管理',
    schools: '📋 核銷管理', school_mgmt: '🏫 學校管理', settings: '⚙️ 系統設定',
    zones: '🗺️ 區別管理',
  }

  return (
    <div className="space-y-6">

      {/* 頂部標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">系統管理後台</h1>
          <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
            {activeSchoolYear} 學年度
          </span>
        </div>
        <div className="flex gap-2">
          {((['overview', 'review', 'schools', 'accounts', 'school_mgmt'] as Tab[])
            .concat(isZoneAdmin ? ['zones' as Tab] : [])
            .concat(isSuperAdmin ? ['settings' as Tab] : [])).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${tab === t ? (t === 'review' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white') : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
              {TAB_LABELS[t]}
              {t === 'review' && pendingCount > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === 'review' ? 'bg-white text-purple-700' : 'bg-purple-600 text-white'}`}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
          {isSuperAdmin && (
            <button onClick={() => setShowImpersonate(true)}
              className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5">
              👤 模擬身分
            </button>
          )}
          <button
            onClick={async () => {
              setRefreshing(true)
              if (tab === 'overview') {
                // 重新取 settlements 和 planAmounts，確保上傳檔案和實支金額是最新的
                await Promise.all([
                  fetch('/api/admin/settlements').then(r => r.json()).then(d => {
                    if (Array.isArray(d)) setLiveSettlements(d)
                  }).catch(() => {}),
                  fetch(`/api/admin/plan-amounts?school_year=${activeSchoolYear}`).then(r => r.json()).then(d => {
                    if (Array.isArray(d)) setLivePlanAmounts(d)
                  }).catch(() => {}),
                ])
                setOverviewKey(k => k + 1)
              } else {
                setTabKeys(prev => ({ ...prev, [tab]: (prev[tab] || 0) + 1 }))
              }
              setTimeout(() => setRefreshing(false), 400)
            }}
            disabled={refreshing}
            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer bg-white text-gray-500 border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
            title="重新整理">
            {refreshing
              ? <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin inline-block" />
              : '↻'}
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <OverviewTab key={overviewKey} schools={schools} amounts={amounts} banks={banks} settlements={liveSettlements} profiles={profiles} contacts={contacts} activeSchoolYear={activeSchoolYear} plans={livePlans} planAmounts={livePlanAmounts} isSuperAdmin={isSuperAdmin} driveFolderId={driveRootFolderId} setDriveFolderId={setDriveRootFolderId} driveFolderUrl={driveRootFolderUrl} setDriveFolderUrl={setDriveRootFolderUrl} handleInitFolders={handleInitFolders} initingFolders={rootInitingFolders} />
      )}
      {tab === 'review' && (
        <ReviewTab key={tabKeys.review} activeSchoolYear={activeSchoolYear} schools={schools} profiles={profiles} contacts={contacts} plans={livePlans}
          onReviewDone={() => {
            setPendingCount(c => Math.max(0, c - 1))
            Promise.all([
              fetch('/api/admin/settlements').then(r => r.json()).then(d => { if (Array.isArray(d)) setLiveSettlements(d) }).catch(() => {}),
              fetch(`/api/admin/plan-amounts?school_year=${activeSchoolYear}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setLivePlanAmounts(d) }).catch(() => {}),
            ]).then(() => setOverviewKey(k => k + 1))
          }} />
      )}
      {tab === 'accounts' && (
        <AccountsTab key={tabKeys.accounts} currentUserEmail={currentUserEmail} isSuperAdmin={isSuperAdmin} />
      )}
      {tab === 'schools' && (
        <SchoolsTab key={tabKeys.schools} activeSchoolYear={activeSchoolYear} plans={livePlans} isSuperAdmin={isSuperAdmin} onPlansChanged={reloadPlans} />
      )}
      {tab === 'school_mgmt' && (
        <SchoolMgmtTab key={tabKeys.school_mgmt} activeSchoolYear={activeSchoolYear} />
      )}
      {tab === 'settings' && (
        <SettingsTab key={tabKeys.settings} activeSchoolYear={activeSchoolYear} />
      )}
      {tab === 'zones' && isZoneAdmin && (
        <ZonesTab isSuperAdmin={isSuperAdmin} />
      )}

      {/* 模擬身分 Modal */}
      {showImpersonate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowImpersonate(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">👤 選擇模擬身分</h2>
              <button onClick={() => setShowImpersonate(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500">選擇學校後，將以該學校身分在新分頁開啟學校端畫面，頁面頂部顯示橘色橫幅可隨時結束模擬。</p>
            <input value={impersonateSearch} onChange={e => setImpersonateSearch(e.target.value)}
              placeholder="搜尋學校名稱或編號..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400" />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {schools.filter(s => s.name.includes(impersonateSearch) || String(s.code).includes(impersonateSearch)).map(s => (
                <button key={s.id} disabled={impersonating}
                  onClick={async () => {
                    setImpersonating(true)
                    await fetch('/api/admin/impersonate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ school_id: s.id, school_name: s.name }),
                    })
                    window.open('/school', '_blank')
                    setShowImpersonate(false)
                    setImpersonating(false)
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-200 transition-colors cursor-pointer disabled:opacity-50">
                  <span className="font-medium text-gray-800 text-sm">{s.name}</span>
                  <span className="text-xs text-gray-400 ml-2">#{s.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 總覽頁籤 ───────────────────────────────────────────────
type StatusFilter = 'all' | 'done' | 'undone'

function OverviewTab({ schools, amounts: initAmounts, banks, settlements: initSettlements, profiles, contacts, activeSchoolYear, plans, planAmounts, isSuperAdmin, driveFolderId, setDriveFolderId, driveFolderUrl, setDriveFolderUrl, handleInitFolders, initingFolders }: {
  schools: School[]; amounts: AmountRow[]; banks: BankRow[]; settlements: SettleRow[]; profiles: ProfileRow[]; contacts: Record<string, ContactInfo>; activeSchoolYear: string
  plans: Plan[]; planAmounts: PlanAmount[]
  isSuperAdmin: boolean; driveFolderId: string; setDriveFolderId: (v: string) => void; driveFolderUrl: string; setDriveFolderUrl: (v: string) => void; handleInitFolders: () => void; initingFolders: boolean
}) {
  // 計畫頁籤：有計畫時用計畫切換，否則保持學期切換
  const hasPlans = plans.length > 0
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [planSem, setPlanSem] = useState<1 | 2>(1)  // 全學年計畫的學期切換
  const [sem, setSem] = useState<1 | 2>(1)

  // 當計畫載入後，預設選第一個
  useEffect(() => {
    if (hasPlans && !selectedPlanId) setSelectedPlanId(plans[0]?.id || null)
  }, [plans])

  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null
  const isFullYear = selectedPlan?.semester == null
  // 以選中計畫的 semester 過濾（全學年用 planSem 切換；若無計畫，用 sem state）
  const effectiveSem: 1 | 2 = hasPlans ? (isFullYear ? planSem : (selectedPlan?.semester ?? 1) as 1 | 2) : sem
  const [search, setSearch] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [zoneFilter, setZoneFilter] = useState<number | null>(null)
  const [zonesMap, setZonesMap] = useState<Record<number, string>>({})
  const [zonesHostMap, setZonesHostMap] = useState<Record<number, string>>({})
  const [bankFilter, setBankFilter] = useState<StatusFilter>('all')
  const [bindFilter, setBindFilter] = useState<StatusFilter>('all')
  const [scanFilter, setScanFilter] = useState<StatusFilter>('all')
  const [remitFilter, setRemitFilter] = useState<StatusFilter>('all')
  const [showRemittanceMenu, setShowRemittanceMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hostSchool, setHostSchool] = useState('')
  const [planName, setPlanName] = useState('')
  const [settlements, setSettlements] = useState<SettleRow[]>(initSettlements)
  const [amounts, setAmounts] = useState<AmountRow[]>(initAmounts)
  // account change requests
  interface ChangeRequest { school_id: number; school_name: string; school_code: number; school_year: string; status: string; new_info: Record<string, string>; file_id: string; submitted_at: string; admin_note: string }
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState<string | null>(null)
  // checkboxes
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // delete file confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ settlementId: number; fileType: 'scan' | 'remittance' } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  // notify modal
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyToast, setNotifyToast] = useState('')
  const [notifySubject, setNotifySubject] = useState('【核銷系統】請儘速完成資料上傳')
  const [notifyMsg, setNotifyMsg] = useState(`{schoolName} 您好，

提醒您尚有核銷資料尚未完成上傳，請儘速登入系統完成作業。

如有問題請聯絡承辦人員：{adminName}　{adminPhone}

臺中市政府教育局`)
  const [notifying, setNotifying] = useState(false)
  const [notifyResult, setNotifyResult] = useState('')

  // settlement/upload change requests
  interface SettleChangeRequest {
    id: string; school_id: number; school_year: string; semester: number; plan_id: string | null
    request_type: 'amount_modify' | 'scan_upload' | 'scan_reupload' | 'remittance_upload' | 'remittance_reupload'
    new_amount: number | null; reason: string; status: string
    admin_note: string | null; created_at: string
    pending_file_path: string | null
    existing_file_path: string | null
    existing_amount: number | null
    approved_amount: number | null
    schools: { name: string; code: number; district: string }
  }
  const [settleRequests, setSettleRequests] = useState<SettleChangeRequest[]>([])
  const [settleReviewNote, setSettleReviewNote] = useState<Record<string, string>>({})
  const [settleReviewing, setSettleReviewing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/zones').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        const map: Record<number, string> = {}
        const hostMap: Record<number, string> = {}
        for (const z of d) { map[z.id] = z.name; hostMap[z.id] = z.host_school || '' }
        setZonesMap(map)
        setZonesHostMap(hostMap)
      }
    }).catch(() => {})
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      if (d.drive_folder_id) setDriveFolderId(d.drive_folder_id)
      if (d.host_school) setHostSchool(d.host_school)
      if (d.plan_name) setPlanName(d.plan_name)
      if (d.notify_subject) setNotifySubject(d.notify_subject)
      if (d.notify_body) setNotifyMsg(d.notify_body)
    }).catch(() => {})
    fetch('/api/admin/drive-folder').then(r => r.json()).then(d => {
      if (d.url) setDriveFolderUrl(d.url)
    }).catch(() => {})
    fetch('/api/admin/account-changes').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setChangeRequests(d)
    }).catch(() => {})
    fetch('/api/admin/change-requests').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setSettleRequests(d)
    }).catch(() => {})
  }, [])

  async function handleSettleReview(id: string, action: 'approved' | 'rejected') {
    setSettleReviewing(id)
    const res = await fetch('/api/admin/change-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_note: settleReviewNote[id] || '' }),
    })
    if (res.ok) {
      setSettleRequests(prev => prev.map(r => r.id === id ? { ...r, status: action } : r))
      if (action === 'approved') {
        fetch('/api/admin/settlements').then(r => r.json()).then(d => {
          if (Array.isArray(d)) setSettlements(d)
        }).catch(() => {})
      }
    }
    setSettleReviewing(null)
  }

  async function handleReview(req: ChangeRequest, action: 'approve' | 'reject') {
    const key = `${req.school_id}_${req.school_year}`
    setReviewing(key)
    const res = await fetch('/api/admin/account-changes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: req.school_id, schoolYear: req.school_year, action, adminNote: reviewNote[key] || '' }),
    })
    if (res.ok) {
      setChangeRequests(prev => prev.map(r =>
        r.school_id === req.school_id && r.school_year === req.school_year
          ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' }
          : r
      ))
    }
    setReviewing(null)
  }

  const districts = Array.from(new Set(schools.map(s => s.district))).sort()
  const zoneIds = Array.from(new Set(schools.map(s => s.zone_id).filter((id): id is number => !!id))).sort((a, b) => a - b)

  function getBank(schoolId: number, semester: number) {
    return banks.find(b => b.school_id === schoolId && b.semester === semester)
  }
  function getSettle(schoolId: number, semester: number, planId?: string | null) {
    if (planId) return settlements.find(s => s.school_id === schoolId && s.plan_id === planId && s.semester === semester)
    return settlements.find(s => s.school_id === schoolId && s.semester === semester && !s.plan_id)
  }
  function getAmount(schoolId: number) {
    return amounts.find(a => a.school_id === schoolId)
  }
  function getBoundEmails(schoolId: number) {
    return profiles.filter(p => p.school_id === schoolId).map(p => p.email)
  }

  const allSemSchools = schools.map(s => ({
    school: s,
    amount: getAmount(s.id),
    bank: getBank(s.id, effectiveSem),
    settle: getSettle(s.id, effectiveSem, selectedPlan?.id),
    boundEmails: getBoundEmails(s.id),
  }))

  const semSchools = allSemSchools.filter(x => {
    // 第5點：選計畫時只顯示有核定金額的學校
    if (selectedPlan) {
      const planSemToCheck = isFullYear ? effectiveSem : (selectedPlan.semester ?? 1)
      const hasAmount = planAmounts.some(a => a.plan_id === selectedPlan.id && a.school_id === x.school.id && a.semester === planSemToCheck && a.amount > 0)
      if (!hasAmount) return false
    }
    const matchZone = zoneFilter === null || x.school.zone_id === zoneFilter
    const matchDistrict = !districtFilter || x.school.district === districtFilter
    const matchSearch = !search || x.school.name.includes(search) || String(x.school.code).includes(search)
    const matchBind = bindFilter === 'all' ? true : bindFilter === 'done' ? x.boundEmails.length > 0 : x.boundEmails.length === 0
    const matchScan = scanFilter === 'all' ? true : scanFilter === 'done' ? !!x.settle?.scan_file_path : !x.settle?.scan_file_path
    const showRemitCol = selectedPlan
      ? selectedPlan.require_repay && !(selectedPlan.deduct_s1_repay && effectiveSem === 1)
      : effectiveSem === 2
    const matchRemit = !showRemitCol || remitFilter === 'all' ? true
      : remitFilter === 'done' ? !!x.settle?.remittance_file_path : !x.settle?.remittance_file_path
    return matchZone && matchDistrict && matchSearch && matchBind && matchScan && matchRemit
  })

  // stats 用 semSchools（已過濾有核定金額的學校）
  const statsBase = selectedPlan ? semSchools : allSemSchools
  const stats = {
    boundCount: statsBase.filter(x => x.boundEmails.length > 0).length,
    scanDone: statsBase.filter(x => x.settle?.scan_file_path).length,
    remitDone: (selectedPlan ? selectedPlan.require_repay && !(selectedPlan.deduct_s1_repay && effectiveSem === 1) : effectiveSem === 2)
      ? statsBase.filter(x => x.settle?.remittance_file_path).length : null,
    totalApproved: selectedPlan
      ? statsBase.reduce((acc, x) => {
          const pa = planAmounts.filter(a => a.plan_id === selectedPlan.id && a.school_id === x.school.id)
          return acc + (isFullYear
            ? pa.find(a => a.semester === effectiveSem)?.amount || 0
            : pa.find(a => a.semester === (selectedPlan.semester ?? 1))?.amount || 0)
        }, 0)
      : allSemSchools.reduce((acc, x) => acc + (effectiveSem === 1 ? (x.amount?.sem1_amount || 0) : (x.amount?.sem2_amount || 0)), 0),
    totalExpense: statsBase.reduce((acc, x) => acc + (x.settle?.total_expense || 0), 0),
    totalSurplus: selectedPlan
      ? statsBase.reduce((acc, x) => {
          const expense = x.settle?.total_expense || 0
          if (expense <= 0) return acc  // 只計算已填寫實支金額的學校
          const pSem = isFullYear ? effectiveSem : (selectedPlan.semester ?? 1)
          const approved = planAmounts.find(a => a.plan_id === selectedPlan.id && a.school_id === x.school.id && a.semester === pSem)?.amount || 0
          const surplus = approved > 0 ? approved - expense : 0
          return acc + (surplus > 0 ? Math.ceil(surplus) : 0)
        }, 0)
      : statsBase.reduce((acc, x) => {
          if (!x.settle || !(x.settle.total_expense > 0)) return acc
          return acc + (x.settle.repay_amount || 0)
        }, 0),
    settledCount: statsBase.filter(x => (x.settle?.total_expense || 0) > 0).length,
  }

  // 各計畫摘要（用於頂部摘要卡）
  const planSummaries = plans.map(p => {
    const pAmounts = planAmounts.filter(a => a.plan_id === p.id)
    const totalAmt = pAmounts.reduce((acc, a) => acc + (a.amount || 0), 0)
    const pSettles = settlements.filter(s => s.plan_id === p.id)
    const schoolsWithAmount = schools.filter(sc => pAmounts.some(a => a.school_id === sc.id && (a.amount || 0) > 0))
    const total = schoolsWithAmount.length
    // 依學期計算各項完成數
    const countBySem = (sem: number | null, check: (s: typeof pSettles[0]) => boolean) =>
      pSettles.filter(s => (sem == null || s.semester === sem) && check(s)).length
    // 依學期分別計算（全學年計畫會用 S1/S2 分開顯示）
    const sems = p.semester == null ? [1, 2] : [p.semester]
    const semStats = sems.map(sem => {
      const semSettles = pSettles.filter(s => s.semester === sem)
      const semSchools = schoolsWithAmount.filter(sc => pAmounts.some(a => a.school_id === sc.id && a.semester === sem && (a.amount || 0) > 0))
      const semTotal = semSchools.length
      const expDone = semSettles.filter(s => (s.total_expense || 0) > 0).length
      const scanD = semSettles.filter(s => !!s.scan_file_path).length
      const remitD = (p.require_repay && !(p.deduct_s1_repay && sem === 1))
        ? semSettles.filter(s => !!s.remittance_file_path).length : null
      return { sem, semTotal, expDone, scanD, remitD }
    })
    return { plan: p, totalAmt, total, semStats }
  })

  const allChecked = semSchools.length > 0 && semSchools.every(x => selected.has(x.school.id))
  function toggleAll() {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(semSchools.map(x => x.school.id)))
  }
  function toggleOne(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', String(sem))
    await fetch('/api/admin/import-bank', { method: 'POST', body: fd })
    setUploading(false)
    window.location.reload()
  }

  async function exportExcel() {
    const planParam = selectedPlan ? `&plan_id=${selectedPlan.id}` : ''
    const res = await fetch(`/api/admin/export?semester=${effectiveSem}&type=bank${planParam}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `第${effectiveSem}學期_帳戶彙整.xlsx`; a.click()
  }

  function openSummaryPrint() {
    // 計畫模式：totalA 從 planAmounts 計算；一般模式：從 school_amounts
    const totalA = selectedPlan
      ? semSchools.reduce((acc, { school }) => {
          const pSem = isFullYear ? effectiveSem : (selectedPlan.semester ?? 1)
          const pa = planAmounts.find(a => a.plan_id === selectedPlan.id && a.school_id === school.id && a.semester === pSem)
          return acc + (pa?.amount || 0)
        }, 0)
      : schools.reduce((acc, s) => {
          const a = amounts.find(x => x.school_id === s.id)
          return acc + (effectiveSem === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0))
        }, 0)

    const totalD = settlements
      .filter(x => x.semester === effectiveSem && (selectedPlan ? x.plan_id === selectedPlan.id : !x.plan_id))
      .reduce((acc, x) => acc + (x.total_expense || 0), 0)

    const B = totalA
    const C = totalA > 0 ? B / totalA : 1
    const E = totalA - totalD
    const F = E > 0 ? Math.ceil(E * C) : 0

    // 區別：取 semSchools 第一筆學校的 zone_id 對應名稱與承辦學校
    const firstZoneId = semSchools[0]?.school?.zone_id
    const printZoneName = firstZoneId ? (zonesMap[firstZoneId] || '') : ''
    const printHostSchool = firstZoneId ? (zonesHostMap[firstZoneId] || hostSchool || '') : (hostSchool || '')
    const printPlanName = selectedPlan ? selectedPlan.name : planName

    const params = new URLSearchParams({
      sem: String(effectiveSem),
      A: String(totalA), B: String(B),
      C: String(C), D: String(totalD),
      E: String(E), F: String(F),
      systemName: printHostSchool || printZoneName || '臺中市第2區',
      schoolYear: activeSchoolYear,
      planName: printPlanName,
      zoneName: printZoneName,
    })
    window.open(`/settlement-print-all?${params}`, '_blank')
  }

  async function exportSurplus() {
    const planParam2 = selectedPlan ? `&plan_id=${selectedPlan.id}` : ''
    const res = await fetch(`/api/admin/export?semester=${effectiveSem}&type=surplus${planParam2}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `第${effectiveSem}學期_賸餘款彙整.xlsx`; a.click()
  }

  function handleDeleteFile(settlementId: number, fileType: 'scan' | 'remittance') {
    setDeleteError('')
    setDeleteConfirm({ settlementId, fileType })
  }

  async function confirmDeleteFile() {
    if (!deleteConfirm) return
    const { settlementId, fileType } = deleteConfirm
    setDeleting(true)
    setDeleteError('')
    const res = await fetch('/api/admin/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId, fileType }),
    })
    setDeleting(false)
    if (res.ok) {
      setSettlements(prev => prev.map(s => {
        if (s.id !== settlementId) return s
        return fileType === 'scan'
          ? { ...s, scan_file_path: null, status: 'downloaded' }
          : { ...s, remittance_file_path: null }
      }))
      setDeleteConfirm(null)
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteError(`刪除失敗：${data.error || res.status}`)
    }
  }

  async function handleSendNotify() {
    setNotifying(true)
    setNotifyResult('')
    const schoolIds = Array.from(selected)
    const res = await fetch('/api/admin/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolIds, subject: notifySubject, message: notifyMsg }),
    })
    const data = await res.json()
    if (res.ok) {
      setNotifyOpen(false)
      setNotifyResult('')
      setNotifyToast(`✅ 催收通知已寄出 ${data.successCount} / ${data.total} 封`)
      setTimeout(() => setNotifyToast(''), 4000)
    } else {
      setNotifyResult(`失敗：${data.error}`)
    }
    setNotifying(false)
  }

  function fileUrl(path: string) {
    if (!path) return '#'
    if (!path.includes('/')) return `https://drive.google.com/file/d/${path}/view`
    return `/api/admin/file?path=${encodeURIComponent(path)}`
  }

  function FilterSelect({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
    return (
      <select value={value} onChange={e => onChange(e.target.value as StatusFilter)}
        className="ml-1 border border-gray-300 rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-400">
        <option value="all">全部</option>
        <option value="done">已完成</option>
        <option value="undone">未完成</option>
      </select>
    )
  }

  return (
    <div className="space-y-6">

      {/* 待審提示 */}
      {(changeRequests.filter(r => r.status === 'pending').length > 0 || settleRequests.filter(r => r.status === 'pending').length > 0) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-purple-700 font-medium text-sm">
            🔔 共有 {changeRequests.filter(r => r.status === 'pending').length + settleRequests.filter(r => r.status === 'pending').length} 件申請待審核
          </span>
          <span className="text-purple-500 text-xs">→ 請至「申請審核」頁籤處理</span>
        </div>
      )}

      {/* 計畫摘要卡（有計畫時顯示） */}
      {hasPlans && planSummaries.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(planSummaries.length, 4)}, 1fr)` }}>
          {planSummaries.map(({ plan, semStats }) => {
            const isSelected = selectedPlanId === plan.id
            const sel = isSelected
            const isFullYearPlan = plan.semester == null
            // 依當前有效學期顯示對應那筆 semStats（全學年計畫跟著 planSem 切換）
            const activeSem = isFullYearPlan ? planSem : (plan.semester ?? 1)
            const stat = semStats.find(s => s.sem === activeSem) ?? semStats[0]
            if (!stat) return null
            const { semTotal, expDone, scanD, remitD } = stat
            const pct = semTotal > 0 ? Math.round(scanD / semTotal * 100) : 0
            const row = (label: string, done: number) => (
              <div className={`flex justify-between text-xs mt-0.5 ${sel ? 'text-blue-100' : 'text-gray-500'}`}>
                <span>{label}</span>
                <span className={`font-semibold ${done === semTotal && semTotal > 0 ? (sel ? 'text-green-300' : 'text-green-600') : ''}`}>{done}/{semTotal}</span>
              </div>
            )
            return (
              <button key={plan.id} onClick={() => { setSelectedPlanId(plan.id); setSelected(new Set()) }}
                className={`rounded-xl p-3 text-left border transition-all cursor-pointer ${sel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                <div className={`text-xs font-semibold ${sel ? 'text-blue-100' : 'text-gray-500'}`}>{plan.name}</div>
                <div className={`font-mono text-xs mb-2 ${sel ? 'text-blue-200' : 'text-gray-400'}`}>{plan.label}</div>
                <div className={`text-xl font-bold mb-0.5 ${sel ? 'text-white' : 'text-blue-700'}`}>{pct}%</div>
                {row('實支已填', expDone)}
                {row('結算表已傳', scanD)}
                {remitD !== null && row('送款憑單', remitD)}
              </button>
            )
          })}
        </div>
      )}

      {/* 全學年計畫的學期切換 */}
      {hasPlans && isFullYear && selectedPlan && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{selectedPlan.label}・選擇學期：</span>
          {([1, 2] as const).map(s => (
            <button key={s} onClick={() => { setPlanSem(s); setSelected(new Set()) }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${planSem === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}>
              第{s}學期
            </button>
          ))}
        </div>
      )}

      {/* 學期切換（無計畫時顯示） */}
      {!hasPlans && (
        <div className="flex items-center gap-2">
          {([1, 2] as const).map(s => (
            <button key={s} onClick={() => { setSem(s); setSelected(new Set()) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${sem === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
              第{s}學期
            </button>
          ))}
        </div>
      )}

      {/* 統計卡 — 進度（無計畫時才顯示個別進度卡） */}
      {!hasPlans && (() => {
        const showRemit = effectiveSem === 2
        return (
          <div className={`grid gap-4 ${showRemit ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <StatCard label="帳號已綁定" value={stats.boundCount} total={schools.length} />
            <StatCard label="實支金額已填" value={stats.settledCount} total={schools.length} />
            <StatCard label="結算表已上傳" value={stats.scanDone} total={schools.length} />
            {showRemit && <StatCard label="送款憑單已上傳" value={stats.remitDone!} total={schools.length} />}
          </div>
        )
      })()}

      {/* 統計卡 — 金額摘要 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500 font-medium">本學期核定總額</p>
          <p className="text-lg font-bold text-blue-700 mt-1">NT$ {formatAmount(stats.totalApproved)}</p>
          <p className="text-xs text-blue-400">{statsBase.length} 校</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4">
          <p className="text-xs text-green-600 font-medium">已核銷實支合計</p>
          <p className="text-lg font-bold text-green-700 mt-1">NT$ {formatAmount(stats.totalExpense)}</p>
          <p className="text-xs text-green-400">{stats.settledCount} 校已填報</p>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-100 p-4">
          <p className="text-xs text-orange-500 font-medium">應繳回總金額</p>
          <p className="text-lg font-bold text-orange-700 mt-1">NT$ {formatAmount(stats.totalSurplus)}</p>
          <p className="text-xs text-orange-400">
            {stats.totalApproved > 0
              ? `執行率 ${((stats.totalExpense / stats.totalApproved) * 100).toFixed(1)}%`
              : '—'}
          </p>
        </div>
      </div>

      {/* 工具列 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        {zoneIds.length > 1 && (
          <select value={zoneFilter ?? ''} onChange={e => setZoneFilter(e.target.value === '' ? null : Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全部分區</option>
            {zoneIds.map(id => <option key={id} value={id}>{zonesMap[id] || `分區 ${id}`}</option>)}
          </select>
        )}
        <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全部行政區</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋學校名稱或編號..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500" />

        <div className="relative">
          <button onClick={() => setShowRemittanceMenu(v => !v)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-1.5">
            📋 匯款清冊 ▾
          </button>
          {showRemittanceMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[160px] py-1"
              onMouseLeave={() => setShowRemittanceMenu(false)}>
              {[
                { label: '全部', bank: '' },
                { label: '臺灣銀行', bank: 'taiwan' },
                { label: '非臺灣銀行', bank: 'other' },
              ].map(({ label, bank }) => (
                <a key={bank}
                  href={`/api/admin/export-remittance?semester=${effectiveSem}${selectedPlan ? `&plan_id=${selectedPlan.id}` : ''}${bank ? `&bank=${bank}` : ''}`}
                  onClick={() => setShowRemittanceMenu(false)}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 cursor-pointer">
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>

        <button onClick={exportSurplus}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
          💰 賸餘款清冊
        </button>

        <button onClick={openSummaryPrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
          📑 經費收支結算表
        </button>

        {(driveFolderUrl || driveFolderId) ? (
          <a href={driveFolderUrl || `https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noopener noreferrer"
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            ☁️ 雲端資料夾
          </a>
        ) : (
          <span className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium cursor-default" title="請先在系統設定填入 Google Drive 資料夾 ID">
            ☁️ 雲端資料夾
          </span>
        )}
        {isSuperAdmin && driveFolderId && (
          <button onClick={handleInitFolders} disabled={initingFolders}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
            {initingFolders ? '建立中…' : '📁 初始化資料夾'}
          </button>
        )}

        {selected.size > 0 && (
          <button onClick={() => setNotifyOpen(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
            📧 催收通知（已選 {selected.size} 校）
          </button>
        )}
      </div>

      {/* 學校清單 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="cursor-pointer" />
              </th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">學校名稱</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">區別</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">核定金額</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">
                帳號綁定 <FilterSelect value={bindFilter} onChange={setBindFilter} />
              </th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">
                結算表 <FilterSelect value={scanFilter} onChange={setScanFilter} />
              </th>
              {(selectedPlan ? selectedPlan.require_repay && !(selectedPlan.deduct_s1_repay && effectiveSem === 1) : sem === 2) && (
                <th className="text-center px-4 py-3 text-gray-600 font-medium">
                  送款憑單 <FilterSelect value={remitFilter} onChange={setRemitFilter} />
                </th>
              )}
              <th className="text-right px-4 py-3 text-gray-600 font-medium">實支金額</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">應繳回</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {semSchools.map(({ school, amount, bank, settle, boundEmails }) => (
              <tr key={school.id} className={`hover:bg-gray-50 ${selected.has(school.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-3 py-3 text-center">
                  <input type="checkbox" checked={selected.has(school.id)} onChange={() => toggleOne(school.id)} className="cursor-pointer" />
                </td>
                <td className="px-4 py-3 text-gray-400">{school.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{school.name}</td>
                <td className="px-4 py-3 text-gray-500">{school.district}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatAmount(selectedPlan
                    ? (planAmounts.find(a => a.plan_id === selectedPlan.id && a.school_id === school.id && a.semester === (isFullYear ? effectiveSem : (selectedPlan.semester ?? 1)))?.amount || 0)
                    : (effectiveSem === 1 ? (amount?.sem1_amount || 0) : (amount?.sem2_amount || 0)))}
                </td>
                <td className="px-4 py-3 text-center">
                  {boundEmails.length > 0 ? (
                    <div className="flex flex-col items-start gap-1">
                      {boundEmails.map(email => {
                        const c = contacts[email]
                        return (
                          <div key={email} className="text-left">
                            <span className="inline-block max-w-[160px] truncate text-xs bg-green-50 text-green-700 border border-green-100 rounded px-1.5 py-0.5" title={email}>
                              {email}
                            </span>
                            {c && (c.contact_name || c.contact_title || c.contact_phone) && (
                              <div className="text-xs text-gray-500 mt-0.5 pl-0.5">
                                {[c.contact_name, c.contact_title, c.contact_phone].filter(Boolean).join('・')}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">未綁定</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const pendingScan = settleRequests.find(r => r.school_id === school.id && (selectedPlan ? r.plan_id === selectedPlan.id : r.semester === sem) && (r.request_type === 'scan_upload' || r.request_type === 'scan_reupload') && r.status === 'pending')
                    return (
                      <div className="flex flex-col items-center gap-0.5">
                        {settle?.scan_file_path ? (
                          <div className="flex items-center gap-1">
                            <a href={fileUrl(settle.scan_file_path)} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200">
                              ✓ 開啟
                            </a>
                            <button onClick={() => settle.id && handleDeleteFile(settle.id, 'scan')}
                              className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer">
                              刪除
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-400">○ 掃描檔</span>
                        )}
                        {pendingScan && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            ⏳ {pendingScan.request_type === 'scan_upload' ? '首次上傳待審' : '重新上傳待審'}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>
                {(selectedPlan ? selectedPlan.require_repay && !(selectedPlan.deduct_s1_repay && effectiveSem === 1) : effectiveSem === 2) && (
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const pendingRemit = settleRequests.find(r => r.school_id === school.id && (selectedPlan ? r.plan_id === selectedPlan.id : r.semester === sem) && (r.request_type === 'remittance_upload' || r.request_type === 'remittance_reupload') && r.status === 'pending')
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          {(() => {
                            // 動態計算結餘，避免依賴 DB 存的舊值
                            let dynamicSurplus = settle?.surplus || 0
                            if (selectedPlan && settle) {
                              const pSem = isFullYear ? effectiveSem : (selectedPlan.semester ?? 1)
                              const approved = planAmounts.find(a => a.plan_id === selectedPlan.id && a.school_id === school.id && a.semester === pSem)?.amount || 0
                              if (approved > 0) dynamicSurplus = approved - (settle.total_expense || 0)
                            }
                            return dynamicSurplus > 0 || settle?.remittance_file_path || pendingRemit
                          })()
                            ? settle?.remittance_file_path
                              ? <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center gap-1">
                                    <a href={fileUrl(settle.remittance_file_path)} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200">
                                      ✓ 開啟
                                    </a>
                                    <button onClick={() => settle.id && handleDeleteFile(settle.id, 'remittance')}
                                      className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer">
                                      刪除
                                    </button>
                                  </div>
                                  {settle.remittance_date && (
                                    <span className="text-xs text-gray-400">{settle.remittance_date}</span>
                                  )}
                                </div>
                              : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-400">○ 憑單</span>
                            : <span className="text-xs text-gray-300">無賸餘</span>
                          }
                          {pendingRemit && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              ⏳ {pendingRemit.request_type === 'remittance_upload' ? '首次上傳待審' : '重新上傳待審'}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                )}
                <td className="px-4 py-3 text-right">
                  {settle?.total_expense
                    ? <span className="text-gray-700">{formatAmount(settle.total_expense)}</span>
                    : <span className="text-gray-300">-</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    // 計畫模式：動態計算結餘，不依賴 DB 儲存的舊值
                    let repay = settle?.repay_amount || 0
                    if (selectedPlan && settle) {
                      const pSem = isFullYear ? effectiveSem : (selectedPlan.semester ?? 1)
                      const approved = planAmounts.find(a => a.plan_id === selectedPlan.id && a.school_id === school.id && a.semester === pSem)?.amount || 0
                      const expense = settle.total_expense || 0
                      const surplus = approved > 0 ? approved - expense : 0
                      repay = surplus > 0 ? Math.ceil(surplus) : 0
                    }
                    return repay > 0
                      ? <span className="text-red-600 font-medium">{formatAmount(repay)}</span>
                      : <span className="text-gray-300">-</span>
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {semSchools.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">無符合條件的學校</p>
        )}
      </div>

      {/* 刪除檔案確認 Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-800">確認刪除</h2>
            <p className="text-sm text-gray-600">
              確定要刪除此{deleteConfirm.fileType === 'scan' ? '收支結算表掃描檔' : '賸餘款送款憑單'}？<br />
              <span className="text-red-500 font-medium">此操作無法復原。</span>
            </p>
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                取消
              </button>
              <button onClick={confirmDeleteFile} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-70 flex items-center gap-2">
                {deleting && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? '刪除中...' : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 催收通知 Modal */}
      {notifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold text-gray-800">發送催收通知</h2>
            <p className="text-sm text-gray-500">將寄送給已選擇的 <span className="font-semibold text-gray-700">{selected.size}</span> 所學校的綁定帳號</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">主旨</label>
              <input value={notifySubject} onChange={e => setNotifySubject(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">內容（可使用 {'{schoolName}'} {'{contactName}'} {'{contactTitle}'} {'{adminName}'} {'{adminPhone}'}）</label>
              <textarea value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} rows={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            {notifyResult && (
              <p className={`text-sm font-medium ${notifyResult.startsWith('成功') ? 'text-green-600' : 'text-red-600'}`}>{notifyResult}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setNotifyOpen(false); setNotifyResult('') }}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 cursor-pointer">
                關閉
              </button>
              <button onClick={handleSendNotify} disabled={notifying}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer">
                {notifying ? '寄送中...' : '確認寄送'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 通知 */}
      {notifyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-6 py-3 rounded-2xl shadow-xl animate-fade-in">
          {notifyToast}
        </div>
      )}
    </div>
  )
}

// ── 申請審核頁籤 ───────────────────────────────────────────
function ReviewTab({ activeSchoolYear, schools, profiles, contacts, plans, onReviewDone }: {
  activeSchoolYear: string
  schools: School[]
  profiles: ProfileRow[]
  contacts: Record<string, ContactInfo>
  plans: Plan[]
  onReviewDone: () => void
}) {
  interface ChangeRequest { school_id: number; school_name: string; school_code: number; school_year: string; status: string; new_info: Record<string, string>; file_id: string; submitted_at: string; admin_note: string }
  interface SettleReq {
    id: string; school_id: number; semester: number; plan_id: string | null; plan_label: string | null
    request_type: string; new_amount: number | null; reason: string; status: string; created_at: string
    pending_file_path: string | null; existing_file_path: string | null
    existing_amount: number | null; approved_amount: number | null
    actual_expense: number | null; surplus: number | null
    schools: { name: string; code: number; district: string }
  }

  const [accountRequests, setAccountRequests] = useState<ChangeRequest[]>([])
  const [settleReqs, setSettleReqs] = useState<SettleReq[]>([])
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const [settleNote, setSettleNote] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [planFilter, setPlanFilter] = useState<string | null>(null) // null = 全部計畫

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/account-changes').then(r => r.json()),
      fetch('/api/admin/change-requests').then(r => r.json()),
    ]).then(([ac, sr]) => {
      setAccountRequests(Array.isArray(ac) ? ac : [])
      setSettleReqs(Array.isArray(sr) ? sr : [])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  async function handleAccountReview(req: ChangeRequest, action: 'approve' | 'reject') {
    const key = `${req.school_id}_${req.school_year}`
    setReviewing(key)
    const res = await fetch('/api/admin/account-changes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: req.school_id, schoolYear: req.school_year, action, adminNote: reviewNote[key] || '' }),
    })
    setReviewing(null)
    if (res.ok) { load(); onReviewDone() }
  }

  async function handleSettleReview(id: string, action: 'approved' | 'rejected') {
    setReviewing(id)
    const res = await fetch('/api/admin/change-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_note: settleNote[id] || '' }),
    })
    if (res.ok) {
      setSettleReqs(prev => prev.map(r => r.id === id ? { ...r, status: action } : r))
      onReviewDone()
    }
    setReviewing(null)
  }

  const pendingAccount = accountRequests.filter(r => r.status === 'pending')
  const pendingSettle = settleReqs.filter(r => r.status === 'pending')
  const totalPending = pendingAccount.length + pendingSettle.length

  const typeLabel = (t: string) => ({
    scan_upload: '首次上傳掃描檔', scan_reupload: '重新上傳掃描檔',
    remittance_upload: '首次上傳送款憑單', remittance_reupload: '重新上傳送款憑單',
    amount_modify: '修改實支金額',
  }[t] || t)

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${subTab === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  if (loading) return <BlockSpinner />

  // 依子分頁 + 計畫 過濾
  const filteredSettle = settleReqs.filter(r => {
    const matchStatus = subTab === 'pending' ? r.status === 'pending' :
      subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
    const matchPlan = planFilter === null
      ? true
      : planFilter === '__no_plan__'
        ? !r.plan_id
        : r.plan_id === planFilter
    return matchStatus && matchPlan
  })
  // 帳戶變更申請有計畫過濾時隱藏（帳戶申請無 plan_id 概念）
  const filteredAccount = accountRequests.filter(r => {
    if (planFilter !== null && planFilter !== '__no_plan__') return false
    return subTab === 'pending' ? r.status === 'pending' :
      subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
  })
  const isEmpty = filteredAccount.length === 0 && filteredSettle.length === 0

  const approvedCount = accountRequests.filter(r => r.status === 'approved').length + settleReqs.filter(r => r.status === 'approved').length
  const rejectedCount = accountRequests.filter(r => r.status === 'rejected').length + settleReqs.filter(r => r.status === 'rejected').length

  return (
    <div className="space-y-4">
      {/* 子分頁 + 重新整理 */}
      <div className="flex items-center gap-2">
        <button className={subTabCls('pending')} onClick={() => setSubTab('pending')}>
          待審核
          {totalPending > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${subTab === 'pending' ? 'bg-white text-purple-700' : 'bg-purple-600 text-white'}`}>{totalPending}</span>}
        </button>
        <button className={subTabCls('approved')} onClick={() => setSubTab('approved')}>
          已通過
          {approvedCount > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${subTab === 'approved' ? 'bg-white text-purple-700' : 'bg-green-100 text-green-700'}`}>{approvedCount}</span>}
        </button>
        <button className={subTabCls('rejected')} onClick={() => setSubTab('rejected')}>
          已拒絕
          {rejectedCount > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${subTab === 'rejected' ? 'bg-white text-purple-700' : 'bg-red-100 text-red-600'}`}>{rejectedCount}</span>}
        </button>
        <button onClick={load} className="ml-auto text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">↻ 重新整理</button>
      </div>

      {/* 計畫篩選（有計畫時顯示） */}
      {plans.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(() => {
            const countForPlan = (planId: string | null) => settleReqs.filter(r => {
              const matchStatus = subTab === 'pending' ? r.status === 'pending' : subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
              const matchPlan = planId === null ? true : r.plan_id === planId
              return matchStatus && matchPlan
            }).length
            const allCount = countForPlan(null)
            return (
              <>
                <button onClick={() => setPlanFilter(null)}
                  className={`px-3 py-1 text-xs rounded-lg cursor-pointer border transition-colors flex items-center gap-1.5 ${planFilter === null ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  全部計畫
                  {allCount > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${planFilter === null ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-600'}`}>{allCount}</span>}
                </button>
                {plans.map(p => {
                  const cnt = countForPlan(p.id)
                  return (
                    <button key={p.id} onClick={() => setPlanFilter(p.id)}
                      className={`px-3 py-1 text-xs rounded-lg cursor-pointer border transition-colors flex items-center gap-1.5 ${planFilter === p.id ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      {p.label}
                      {cnt > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${planFilter === p.id ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-600'}`}>{cnt}</span>}
                    </button>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}

      {/* 帳戶變更申請 */}
      {filteredAccount.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-orange-700">📋 帳戶變更申請（{filteredAccount.length} 件）</h3>
          {filteredAccount.map(req => {
            const key = `${req.school_id}_${req.school_year}`
            const isDone = req.status !== 'pending'
            return (
              <div key={key} className="bg-white rounded-xl border border-orange-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{req.school_name}</span>
                    <span className="text-xs text-gray-400">{new Date(req.submitted_at).toLocaleString('zh-TW')}</span>
                    {isDone && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{req.status === 'approved' ? '✓ 已通過' : '✗ 已拒絕'}</span>}
                  </div>
                  <a href={`https://drive.google.com/file/d/${req.file_id}/view`} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1 rounded-lg">📄 開啟附件</a>
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-1">
                  {Object.entries(req.new_info).map(([k, v]) => (
                    <span key={k}><span className="text-gray-400">{({ bank_name: '銀行', branch_name: '分行', bank_code: '代碼', account_name: '戶名', account_number: '帳號' } as Record<string, string>)[k] || k}：</span>{v}</span>
                  ))}
                </div>
                {!isDone && (
                  <div className="flex gap-2 items-center">
                    <input value={reviewNote[key] || ''} onChange={e => setReviewNote(p => ({ ...p, [key]: e.target.value }))}
                      placeholder="備註（選填）" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
                    <button onClick={() => handleAccountReview(req, 'approve')} disabled={reviewing === key}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-lg cursor-pointer">
                      {reviewing === key ? <span className='flex items-center gap-1'><Spinner size='xs' /> 處理中...</span> : '核准'}
                    </button>
                    <button onClick={() => handleAccountReview(req, 'reject')} disabled={reviewing === key}
                      className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-lg cursor-pointer">拒絕</button>
                  </div>
                )}
                {isDone && req.admin_note && (
                  <p className="text-xs text-gray-400">備註：{req.admin_note}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 核銷相關申請（首次上傳 + 重新上傳 + 金額修改） */}
      {filteredSettle.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-violet-700">✏️ 核銷申請（{filteredSettle.length} 件）</h3>
          {filteredSettle.map(req => {
            const tl = typeLabel(req.request_type)
            const boundEmail = profiles.find(p => p.school_id === req.school_id)?.email
            const c = boundEmail ? contacts[boundEmail] : null
            const isFile = req.request_type !== 'amount_modify'
            const isFirstUpload = req.request_type === 'scan_upload' || req.request_type === 'remittance_upload'
            const fileDesc = req.request_type.includes('scan') ? '經費收支結算表掃描檔' : '賸餘款送款憑單'
            const isDone = req.status !== 'pending'
            const actionColor = isFirstUpload ? 'blue' : 'violet'
            return (
              <div key={req.id} className={`bg-white rounded-xl border p-4 space-y-3 ${isFirstUpload ? 'border-blue-200' : 'border-violet-200'}`}>
                {/* 標題列：清楚說明審核動作 */}
                <div className={`rounded-lg px-3 py-2 ${isFirstUpload ? 'bg-blue-50' : 'bg-violet-50'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isFirstUpload ? 'text-blue-800' : 'text-violet-800'}`}>
                        {req.request_type === 'amount_modify' ? '📝' : '📄'} {tl}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isFirstUpload ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                      {req.plan_label ? `${req.plan_label}・第${req.semester}學期` : `第${req.semester}學期`}
                    </span>
                  </div>
                  {isFile && (
                    <p className={`text-xs mt-1 ${isFirstUpload ? 'text-blue-600' : 'text-violet-600'}`}>
                      審核文件：<strong>{fileDesc}</strong>
                      {isFirstUpload ? '（首次上傳，核准後生效）' : '（重新上傳，核准後取代現有檔案）'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{req.schools?.name}</span>
                  <span className="text-xs text-gray-400">・{new Date(req.created_at).toLocaleString('zh-TW')}</span>
                </div>

                {(boundEmail || c) && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                    {boundEmail && <span>📧 {boundEmail}</span>}
                    {c?.contact_name && <span>👤 {c.contact_name}{c.contact_title ? `・${c.contact_title}` : ''}</span>}
                    {c?.contact_phone && <span>📞 {c.contact_phone}</span>}
                  </div>
                )}

                {req.request_type === 'amount_modify' && req.new_amount != null && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm flex flex-wrap items-center gap-4">
                    {req.approved_amount != null && (
                      <><div><span className="text-xs text-blue-400 block mb-0.5">核定金額</span>
                        <span className="font-medium text-blue-600">NT$ {formatAmount(req.approved_amount)}</span></div>
                      <span className="text-gray-300">│</span></>
                    )}
                    <div><span className="text-xs text-gray-400 block mb-0.5">目前實支</span>
                      <span className="font-medium text-gray-600">{req.existing_amount != null ? `NT$ ${formatAmount(req.existing_amount)}` : '—'}</span></div>
                    <span className="text-gray-400 text-lg">→</span>
                    <div><span className="text-xs text-gray-400 block mb-0.5">申請修改為</span>
                      <span className="font-bold text-gray-800">NT$ {formatAmount(req.new_amount)}</span></div>
                  </div>
                )}

                {isFile && (
                  <div className="space-y-2">
                    {/* 財務摘要 */}
                    {(req.approved_amount != null || req.actual_expense != null) && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-x-5 gap-y-1">
                        {req.approved_amount != null && (
                          <div><span className="text-gray-400">核定金額　</span><span className="font-semibold text-blue-700">NT$ {formatAmount(req.approved_amount)}</span></div>
                        )}
                        {req.actual_expense != null && (
                          <div><span className="text-gray-400">實支金額　</span><span className="font-semibold text-gray-800">NT$ {formatAmount(req.actual_expense)}</span></div>
                        )}
                        {req.surplus != null && (
                          <div>
                            <span className="text-gray-400">結餘款　</span>
                            <span className={`font-semibold ${req.surplus > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              NT$ {formatAmount(req.surplus)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* 檔案連結 */}
                    <div className="flex gap-2 flex-wrap">
                      {req.existing_file_path && (
                        <a href={`https://drive.google.com/file/d/${req.existing_file_path}/view`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg">
                          📄 現有檔案
                        </a>
                      )}
                      {req.pending_file_path && (
                        <a href={`https://drive.google.com/file/d/${req.pending_file_path}/view`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg">
                          📄 待審檔案
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {req.reason && req.reason !== '首次上傳' && !req.reason.startsWith('DATE:') && (
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-400">申請原因：</span>{req.reason}
                  </div>
                )}

                {isDone ? (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${req.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {req.status === 'approved' ? '✓ 已核准' : '✗ 已拒絕'}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input value={settleNote[req.id] || ''} onChange={e => setSettleNote(p => ({ ...p, [req.id]: e.target.value }))}
                      placeholder="備註（選填）" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-violet-400" />
                    <button onClick={() => handleSettleReview(req.id, 'approved')} disabled={reviewing === req.id}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-lg cursor-pointer">
                      {reviewing === req.id ? <span className='flex items-center gap-1'><Spinner size='xs' /> 處理中...</span> : '核准'}
                    </button>
                    <button onClick={() => handleSettleReview(req.id, 'rejected')} disabled={reviewing === req.id}
                      className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-lg cursor-pointer">拒絕</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isEmpty && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">{subTab === 'pending' ? '✅' : subTab === 'approved' ? '📋' : '📋'}</div>
          <p className="font-medium">{subTab === 'pending' ? '目前沒有待審核的申請' : subTab === 'approved' ? '尚無已通過的申請' : '尚無已拒絕的申請'}</p>
        </div>
      )}
    </div>
  )
}


// ── 學年度管理頁籤 ─────────────────────────────────────────


function StatCard({ label, value, total, warn, isAmount }: {
  label: string; value: number | string; total?: number; warn?: string; isAmount?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">
        {isAmount ? value : `${value}${total !== undefined ? ` / ${total}` : ''}`}
      </p>
      {warn && <p className="text-xs text-orange-500 mt-1">{warn}</p>}
    </div>
  )
}
