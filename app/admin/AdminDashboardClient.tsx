'use client'
import { useDialog } from '@/components/DialogProvider'
import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { BlockSpinner } from '@/components/Spinner'
import type { School, AmountRow, BankRow, SettleRow, ProfileRow, ContactInfo, Plan, PlanAmount } from './types'
import OverviewTab from './tabs/OverviewTab'
import ReviewTab from './tabs/ReviewTab'

// 動態載入較重的頁籤，減少初始 JS bundle
const SchoolsTab = dynamic(() => import('./tabs/SchoolsTab'), { loading: () => <BlockSpinner /> })
const SchoolMgmtTab = dynamic(() => import('./tabs/SchoolMgmtTab'), { loading: () => <BlockSpinner /> })
const AccountsTab = dynamic(() => import('./tabs/AccountsTab'), { loading: () => <BlockSpinner /> })
const SettingsTab = dynamic(() => import('./tabs/SettingsTab'), { loading: () => <BlockSpinner /> })
const ZonesTab = dynamic(() => import('./tabs/ZonesTab'), { loading: () => <BlockSpinner /> })

type Tab = 'overview' | 'review' | 'accounts' | 'schools' | 'school_mgmt' | 'settings' | 'zones'


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
  const dialog = useDialog()
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
    if (!(await dialog.confirm({ title: '初始化資料夾', message: '將在 Google Drive 根資料夾下，為所有分區建立本學年度的子資料夾。', confirmLabel: '開始建立' }))) return
    setRootInitingFolders(true)
    const res = await fetch('/api/admin/init-drive-folders', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setRootInitingFolders(false)
    if (d.ok) await dialog.alert({ title: '資料夾建立完成', message: (d.paths as string[]).join('\n'), tone: 'success' })
    else await dialog.alert({ title: '建立失敗', message: d.error || '請稍後再試', tone: 'error' })
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
        <OverviewTab key={overviewKey} schools={schools} amounts={amounts} banks={banks} settlements={liveSettlements} profiles={profiles} contacts={contacts} activeSchoolYear={activeSchoolYear} plans={livePlans} planAmounts={livePlanAmounts} driveFolderId={driveRootFolderId} setDriveFolderId={setDriveRootFolderId} driveFolderUrl={driveRootFolderUrl} setDriveFolderUrl={setDriveRootFolderUrl} />
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
        <SettingsTab key={tabKeys.settings} activeSchoolYear={activeSchoolYear} handleInitFolders={handleInitFolders} initingFolders={rootInitingFolders} />
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
