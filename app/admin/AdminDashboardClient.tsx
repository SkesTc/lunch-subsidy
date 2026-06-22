'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { formatAmount } from '@/lib/utils'
import { Spinner, BlockSpinner } from '@/components/Spinner'
import type { School, AmountRow, BankRow, SettleRow, ProfileRow, ContactInfo } from './types'

// 動態載入較重的頁籤，減少初始 JS bundle
const SchoolsTab = dynamic(() => import('./tabs/SchoolsTab'), { loading: () => <BlockSpinner /> })
const AccountsTab = dynamic(() => import('./tabs/AccountsTab'), { loading: () => <BlockSpinner /> })
const SettingsTab = dynamic(() => import('./tabs/SettingsTab'), { loading: () => <BlockSpinner /> })


type Tab = 'overview' | 'review' | 'accounts' | 'schools' | 'settings'

export default function AdminDashboardClient({
  schools, amounts, banks, settlements, profiles, contacts, currentUserEmail, activeSchoolYear
}: {
  schools: School[]; amounts: AmountRow[]; banks: BankRow[]; settlements: SettleRow[]
  profiles: ProfileRow[]; contacts: Record<string, ContactInfo>
  currentUserEmail: string; activeSchoolYear: string
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [pendingCount, setPendingCount] = useState(0)
  const [overviewKey, setOverviewKey] = useState(0)

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

  const TAB_LABELS: Record<Tab, string> = {
    overview: '總覽', review: '申請審核', accounts: '帳號管理', schools: '學校管理', settings: '系統設定'
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
          {(['overview', 'review', 'accounts', 'schools', 'settings'] as Tab[]).map(t => (
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
          {tab === 'overview' && (
            <button onClick={() => window.location.reload()}
              className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer bg-white text-gray-500 border border-gray-300 hover:bg-gray-50"
              title="重新整理">
              ↻
            </button>
          )}
        </div>
      </div>

      {tab === 'overview' && (
        <OverviewTab key={overviewKey} schools={schools} amounts={amounts} banks={banks} settlements={settlements} profiles={profiles} contacts={contacts} activeSchoolYear={activeSchoolYear} />
      )}
      {tab === 'review' && (
        <ReviewTab activeSchoolYear={activeSchoolYear} schools={schools} profiles={profiles} contacts={contacts}
          onReviewDone={() => { setPendingCount(c => Math.max(0, c - 1)); setOverviewKey(k => k + 1) }} />
      )}
      {tab === 'accounts' && (
        <AccountsTab currentUserEmail={currentUserEmail} />
      )}
      {tab === 'schools' && (
        <SchoolsTab activeSchoolYear={activeSchoolYear} />
      )}
      {tab === 'settings' && (
        <SettingsTab />
      )}
    </div>
  )
}

// ── 總覽頁籤 ───────────────────────────────────────────────
type StatusFilter = 'all' | 'done' | 'undone'

function OverviewTab({ schools, amounts: initAmounts, banks, settlements: initSettlements, profiles, contacts, activeSchoolYear }: {
  schools: School[]; amounts: AmountRow[]; banks: BankRow[]; settlements: SettleRow[]; profiles: ProfileRow[]; contacts: Record<string, ContactInfo>; activeSchoolYear: string
}) {
  const [sem, setSem] = useState<1 | 2>(1)
  const [search, setSearch] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [bankFilter, setBankFilter] = useState<StatusFilter>('all')
  const [bindFilter, setBindFilter] = useState<StatusFilter>('all')
  const [scanFilter, setScanFilter] = useState<StatusFilter>('all')
  const [remitFilter, setRemitFilter] = useState<StatusFilter>('all')
  const [uploading, setUploading] = useState(false)
  const [driveFolderId, setDriveFolderId] = useState('')
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
    id: string; school_id: number; school_year: string; semester: number
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
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      if (d.drive_folder_id) setDriveFolderId(d.drive_folder_id)
      if (d.host_school) setHostSchool(d.host_school)
      if (d.plan_name) setPlanName(d.plan_name)
      if (d.notify_subject) setNotifySubject(d.notify_subject)
      if (d.notify_body) setNotifyMsg(d.notify_body)
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

  function getBank(schoolId: number, semester: number) {
    return banks.find(b => b.school_id === schoolId && b.semester === semester)
  }
  function getSettle(schoolId: number, semester: number) {
    return settlements.find(s => s.school_id === schoolId && s.semester === semester)
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
    bank: getBank(s.id, sem),
    settle: getSettle(s.id, sem),
    boundEmails: getBoundEmails(s.id),
  }))

  const semSchools = allSemSchools.filter(x => {
    const matchDistrict = !districtFilter || x.school.district === districtFilter
    const matchSearch = !search || x.school.name.includes(search) || String(x.school.code).includes(search)
    const matchBind = bindFilter === 'all' ? true : bindFilter === 'done' ? x.boundEmails.length > 0 : x.boundEmails.length === 0
    const matchScan = scanFilter === 'all' ? true : scanFilter === 'done' ? !!x.settle?.scan_file_path : !x.settle?.scan_file_path
    const matchRemit = sem !== 2 || remitFilter === 'all' ? true
      : remitFilter === 'done' ? !!x.settle?.remittance_file_path : !x.settle?.remittance_file_path
    return matchDistrict && matchSearch && matchBind && matchScan && matchRemit
  })

  const stats = {
    boundCount: allSemSchools.filter(x => x.boundEmails.length > 0).length,
    scanDone: allSemSchools.filter(x => x.settle?.scan_file_path).length,
    remitDone: sem === 2 ? allSemSchools.filter(x => x.settle?.remittance_file_path).length : null,
    totalApproved: allSemSchools.reduce((acc, x) => acc + (sem === 1 ? (x.amount?.sem1_amount || 0) : (x.amount?.sem2_amount || 0)), 0),
    totalExpense: allSemSchools.reduce((acc, x) => acc + (x.settle?.total_expense || 0), 0),
    totalSurplus: allSemSchools.reduce((acc, x) => acc + (x.settle?.repay_amount || 0), 0),
    settledCount: allSemSchools.filter(x => (x.settle?.total_expense || 0) > 0).length,
  }

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
    const res = await fetch(`/api/admin/export?semester=${sem}&type=bank`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `第${sem}學期_帳戶彙整.xlsx`; a.click()
  }

  function openSummaryPrint() {
    const totalA = schools.reduce((acc, s) => {
      const a = amounts.find(x => x.school_id === s.id)
      return acc + (sem === 1 ? (a?.sem1_amount || 0) : (a?.sem2_amount || 0))
    }, 0)
    const totalD = settlements
      .filter(x => x.semester === sem)
      .reduce((acc, x) => acc + (x.total_expense || 0), 0)
    const B = totalA
    const C = totalA > 0 ? B / totalA : 1
    const E = totalA - totalD
    const F = E > 0 ? Math.ceil(E * C) : 0
    const params = new URLSearchParams({
      sem: String(sem),
      A: String(totalA), B: String(B),
      C: String(C), D: String(totalD),
      E: String(E), F: String(F),
      systemName: hostSchool || '臺中市第2區',
      schoolYear: activeSchoolYear,
      planName,
    })
    window.open(`/settlement-print-all?${params}`, '_blank')
  }

  async function exportSurplus() {
    const res = await fetch(`/api/admin/export?semester=${sem}&type=surplus`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `第${sem}學期_賸餘款彙整.xlsx`; a.click()
  }

  async function handleDeleteFile(settlementId: number, fileType: 'scan' | 'remittance') {
    if (!confirm('確定要刪除此檔案？此操作無法復原。')) return
    const res = await fetch('/api/admin/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId, fileType }),
    })
    if (res.ok) {
      setSettlements(prev => prev.map(s => {
        if (s.id !== settlementId) return s
        return fileType === 'scan'
          ? { ...s, scan_file_path: null, status: 'downloaded' }
          : { ...s, remittance_file_path: null }
      }))
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

      <div className="flex items-center gap-2">
        {([1, 2] as const).map(s => (
          <button key={s} onClick={() => { setSem(s); setSelected(new Set()) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${sem === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
            第{s}學期
          </button>
        ))}
      </div>

      {/* 統計卡 — 進度 */}
      <div className={`grid gap-4 ${sem === 2 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <StatCard label="帳號已綁定" value={stats.boundCount} total={schools.length} />
        <StatCard label="實支金額已填" value={stats.settledCount} total={schools.length} />
        <StatCard label="結算表已上傳" value={stats.scanDone} total={schools.length} />
        {sem === 2 && <StatCard label="送款憑單已上傳" value={stats.remitDone!} total={schools.length} />}
      </div>

      {/* 統計卡 — 金額摘要 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500 font-medium">本學期核定總額</p>
          <p className="text-lg font-bold text-blue-700 mt-1">NT$ {formatAmount(stats.totalApproved)}</p>
          <p className="text-xs text-blue-400">{schools.length} 校</p>
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
        <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">全部區別</option>
          {districts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋學校名稱或編號..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500" />

        <a href={`/api/admin/export-remittance?semester=${sem}`}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          📋 匯款清冊
        </a>

        <button onClick={exportSurplus}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
          💰 賸餘款清冊
        </button>

        <button onClick={openSummaryPrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
          📑 經費收支結算表
        </button>

        {driveFolderId ? (
          <a href={`https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noopener noreferrer"
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            ☁️ 雲端資料夾
          </a>
        ) : (
          <span className="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium cursor-default" title="請先在系統設定填入 Google Drive 資料夾 ID">
            ☁️ 雲端資料夾
          </span>
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
              {sem === 2 && (
                <th className="text-center px-4 py-3 text-gray-600 font-medium">
                  送款憑單 <FilterSelect value={remitFilter} onChange={setRemitFilter} />
                </th>
              )}
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
                  {formatAmount(sem === 1 ? (amount?.sem1_amount || 0) : (amount?.sem2_amount || 0))}
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
                    const pendingScan = settleRequests.find(r => r.school_id === school.id && r.semester === sem && (r.request_type === 'scan_upload' || r.request_type === 'scan_reupload') && r.status === 'pending')
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
                {sem === 2 && (
                  <td className="px-4 py-3 text-center">
                    {(() => {
                      const pendingRemit = settleRequests.find(r => r.school_id === school.id && r.semester === sem && (r.request_type === 'remittance_upload' || r.request_type === 'remittance_reupload') && r.status === 'pending')
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          {(settle?.surplus || 0) > 0
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
                  {(settle?.repay_amount || 0) > 0
                    ? <span className="text-red-600 font-medium">{formatAmount(settle!.repay_amount)}</span>
                    : <span className="text-gray-300">-</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {semSchools.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">無符合條件的學校</p>
        )}
      </div>

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
function ReviewTab({ activeSchoolYear, schools, profiles, contacts, onReviewDone }: {
  activeSchoolYear: string
  schools: School[]
  profiles: ProfileRow[]
  contacts: Record<string, ContactInfo>
  onReviewDone: () => void
}) {
  interface ChangeRequest { school_id: number; school_name: string; school_code: number; school_year: string; status: string; new_info: Record<string, string>; file_id: string; submitted_at: string; admin_note: string }
  interface SettleReq {
    id: string; school_id: number; semester: number; request_type: string
    new_amount: number | null; reason: string; status: string; created_at: string
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
      body: JSON.stringify({ school_id: req.school_id, school_year: req.school_year, action, admin_note: reviewNote[key] || '' }),
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

  // 依子分頁過濾
  const filteredAccount = accountRequests.filter(r =>
    subTab === 'pending' ? r.status === 'pending' :
    subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
  )
  const filteredSettle = settleReqs.filter(r =>
    subTab === 'pending' ? r.status === 'pending' :
    subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
  )
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
                      第{req.semester}學期
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
