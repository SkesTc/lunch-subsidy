'use client'
import { useState, useEffect } from 'react'
import { formatAmount } from '@/lib/utils'

interface School {
  id: number; code: number; district: string; name: string
}
interface AmountRow {
  school_id: number; school_year: string; sem1_amount: number; sem2_amount: number; approved_total: number
}
interface BankRow { school_id: number; semester: number; confirmed_at: string | null; is_modified: boolean; bank_name: string | null; branch_name: string | null; bank_code: string | null; account_name: string | null; account_number: string | null }
interface SettleRow {
  id: number; school_id: number; semester: number; status: string
  scan_file_path: string | null; remittance_file_path: string | null; remittance_date: string | null
  repay_amount: number; surplus: number; total_expense: number
}
interface ProfileRow { email: string; school_id: number | null; is_admin: boolean }
interface ContactInfo { contact_name: string; contact_title: string; contact_phone: string }

type Tab = 'overview' | 'review' | 'accounts' | 'schools' | 'settings' | 'schoolyear'

export default function AdminDashboardClient({
  schools, amounts, banks, settlements, profiles, contacts, currentUserEmail, activeSchoolYear, allSchoolYears
}: {
  schools: School[]; amounts: AmountRow[]; banks: BankRow[]; settlements: SettleRow[]
  profiles: ProfileRow[]; contacts: Record<string, ContactInfo>
  currentUserEmail: string; activeSchoolYear: string; allSchoolYears: string[]
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
    overview: '總覽', review: '申請審核', accounts: '帳號管理', schools: '學校管理', settings: '系統設定', schoolyear: '學年度管理'
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
          {(['overview', 'review', 'accounts', 'schools', 'settings', 'schoolyear'] as Tab[]).map(t => (
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
      {tab === 'schoolyear' && (
        <SchoolYearTab activeSchoolYear={activeSchoolYear} allSchoolYears={allSchoolYears} />
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

  if (loading) return <div className="text-center py-8 text-gray-400">載入中...</div>

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
                      {reviewing === key ? '處理中...' : '核准'}
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
                      {reviewing === req.id ? '處理中...' : '核准'}
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

// ── 帳號管理頁籤 ───────────────────────────────────────────
interface AccountRow {
  id: string
  email: string
  school_id: number | null
  is_admin: boolean
  contact_name?: string
  contact_title?: string
  contact_phone?: string
  schools?: { name: string; code: number; district: string } | null
}

// ── 學校管理頁籤 ───────────────────────────────────────────────
function SchoolsTab({ activeSchoolYear }: { activeSchoolYear: string }) {
  interface SchoolFull { id: number; code: number; district: string; name: string; is_active: boolean }
  const [schools, setSchools] = useState<SchoolFull[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newDistrict, setNewDistrict] = useState('')
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  // 帳戶 Excel 匯入／匯出
  const [bankSem, setBankSem] = useState<1 | 2>(1)
  const [bankUploading, setBankUploading] = useState(false)
  // 核定金額編輯
  interface AmountRow { school_id: number; sem1_amount: number; sem2_amount: number }
  const [amounts, setAmounts] = useState<AmountRow[]>([])
  const [editingAmounts, setEditingAmounts] = useState(false)
  const [amountEdits, setAmountEdits] = useState<Record<number, { sem1: string; sem2: string }>>({})
  const [savingAmounts, setSavingAmounts] = useState(false)
  // 帳戶資訊 modal
  interface BankRow { school_id: number; semester: number; bank_name: string | null; branch_name: string | null; bank_code: string | null; account_name: string | null; account_number: string | null }
  interface BankEditState { schoolId: number; schoolName: string; semester: number; bank_name: string; branch_name: string; bank_code: string; account_name: string; account_number: string }
  const [banks, setBanks] = useState<BankRow[]>([])
  const [bankEdit, setBankEdit] = useState<BankEditState | null>(null)
  const [bankEditing, setBankEditing] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [bankError, setBankError] = useState('')

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/schools-manage').then(r => r.json()),
      fetch(`/api/admin/amounts?school_year=${activeSchoolYear}`).then(r => r.json()),
      fetch('/api/admin/bank-edit').then(r => r.json()),
    ]).then(([schoolData, amountData, bankData]) => {
      setSchools(schoolData)
      setAmounts(Array.isArray(amountData) ? amountData : [])
      setBanks(Array.isArray(bankData) ? bankData : [])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  function getBank(schoolId: number, semester: number) {
    return banks.find(b => b.school_id === schoolId && b.semester === semester)
  }

  function openBankEdit(school: SchoolFull, sem: number) {
    const bank = getBank(school.id, sem)
    setBankEdit({
      schoolId: school.id, schoolName: school.name, semester: sem,
      bank_name: bank?.bank_name || '', branch_name: bank?.branch_name || '',
      bank_code: bank?.bank_code || '', account_name: bank?.account_name || '',
      account_number: bank?.account_number || '',
    })
    setBankEditing(false); setBankError('')
  }

  async function saveBankEdit() {
    if (!bankEdit) return
    setBankSaving(true); setBankError('')
    const res = await fetch('/api/admin/bank-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bankEdit),
    })
    if (res.ok) { window.location.reload() }
    else { const d = await res.json().catch(() => ({})); setBankError(d.error || '儲存失敗'); setBankSaving(false) }
  }

  function closeBankModal() { setBankEdit(null); setBankEditing(false) }

  function getAmount(schoolId: number) {
    return amounts.find(a => a.school_id === schoolId)
  }

  function startEditAmounts() {
    const init: Record<number, { sem1: string; sem2: string }> = {}
    schools.forEach(s => {
      const a = getAmount(s.id)
      init[s.id] = { sem1: String(a?.sem1_amount || 0), sem2: String(a?.sem2_amount || 0) }
    })
    setAmountEdits(init)
    setEditingAmounts(true)
  }

  async function saveAmounts() {
    setSavingAmounts(true)
    const changed = schools.filter(s => {
      const e = amountEdits[s.id]
      const a = getAmount(s.id)
      return e && (Number(e.sem1) !== (a?.sem1_amount || 0) || Number(e.sem2) !== (a?.sem2_amount || 0))
    })
    await Promise.all(changed.map(s => {
      const e = amountEdits[s.id]
      return fetch('/api/admin/amounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: s.id, school_year: activeSchoolYear, sem1_amount: Number(e.sem1), sem2_amount: Number(e.sem2) }),
      })
    }))
    setSavingAmounts(false)
    setEditingAmounts(false)
    load()
  }

  async function toggleActive(school: SchoolFull) {
    await fetch('/api/admin/schools-manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: school.id, is_active: !school.is_active }),
    })
    setSchools(prev => prev.map(s => s.id === school.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function handleAdd() {
    if (!newCode || !newDistrict || !newName) { setAddError('請填寫所有欄位'); return }
    setAdding(true); setAddError('')
    const res = await fetch('/api/admin/schools-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: Number(newCode), district: newDistrict, name: newName }),
    })
    if (res.ok) {
      setShowAdd(false); setNewCode(''); setNewDistrict(''); setNewName('')
      load()
    } else {
      const d = await res.json().catch(() => ({}))
      setAddError(d.error || '新增失敗')
    }
    setAdding(false)
  }

  async function handleImportBank(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBankUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', String(bankSem))
    await fetch('/api/admin/import-bank', { method: 'POST', body: fd })
    setBankUploading(false)
    e.target.value = ''
    window.location.reload()
  }

  async function exportBankExcel() {
    const res = await fetch(`/api/admin/export?semester=${bankSem}&type=bank`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `第${bankSem}學期_帳戶彙整.xlsx`; a.click()
  }

  async function handleImportAmounts() {
    if (!importFile) return
    setImporting(true); setImportResult('')
    const fd = new FormData()
    fd.append('file', importFile)
    fd.append('school_year', activeSchoolYear)
    const res = await fetch('/api/admin/import-amounts', { method: 'POST', body: fd })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      setImportResult(`✓ 成功匯入 ${d.updated} 筆${d.errors?.length ? `，${d.errors.length} 筆錯誤` : ''}`)
      setImportFile(null)
    } else {
      setImportResult(`✗ ${d.error || '匯入失敗'}`)
    }
    setImporting(false)
  }

  const [subTab, setSubTab] = useState<'list' | 'bank' | 'amounts'>('list')
  const filtered = schools.filter(s => !search || s.name.includes(search) || String(s.code).includes(search))
  const activeCount = schools.filter(s => s.is_active).length

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  const bankFields = [
    { key: 'bank_name' as keyof BankEditState, label: '銀行名稱' },
    { key: 'branch_name' as keyof BankEditState, label: '分行名稱' },
    { key: 'bank_code' as keyof BankEditState, label: '金融機構代碼' },
    { key: 'account_name' as keyof BankEditState, label: '帳戶戶名' },
    { key: 'account_number' as keyof BankEditState, label: '帳號' },
  ]

  return (
    <div className="space-y-4">
      {/* 子分頁切換 */}
      <div className="flex gap-2">
        <button className={subTabCls('list')} onClick={() => setSubTab('list')}>學校清單管理</button>
        <button className={subTabCls('bank')} onClick={() => setSubTab('bank')}>學校帳戶管理</button>
        <button className={subTabCls('amounts')} onClick={() => setSubTab('amounts')}>核定金額管理</button>
      </div>

      {/* ── 學校清單管理 ── */}
      {subTab === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">學校清單管理</h2>
              <p className="text-sm text-gray-400 mt-0.5">啟用中 {activeCount} 校・共 {schools.length} 校</p>
            </div>
            <button onClick={() => { setShowAdd(!showAdd); setAddError('') }}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
              + 新增學校
            </button>
          </div>

          {showAdd && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-800">新增學校</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">編號</label>
                  <input type="number" value={newCode} onChange={e => setNewCode(e.target.value)}
                    placeholder="例：91" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">區別</label>
                  <input type="text" value={newDistrict} onChange={e => setNewDistrict(e.target.value)}
                    placeholder="例：豐原區" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">學校名稱</label>
                  <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="例：豐原區○○國民小學" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 cursor-pointer hover:bg-gray-50">取消</button>
                <button onClick={handleAdd} disabled={adding}
                  className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white cursor-pointer">
                  {adding ? '新增中...' : '確認新增'}
                </button>
              </div>
            </div>
          )}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學校名稱或編號..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />

          {loading ? (
            <p className="text-center text-gray-400 py-4 text-sm">載入中...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 rounded-lg">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">區別</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">學校名稱</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">狀態</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(s => (
                    <tr key={s.id} className={`${s.is_active ? '' : 'opacity-40'}`}>
                      <td className="px-3 py-2.5 text-gray-400">{s.code}</td>
                      <td className="px-3 py-2.5 text-gray-500">{s.district}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{s.name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {s.is_active ? '啟用' : '停用'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => toggleActive(s)}
                          className={`px-3 py-1 rounded text-xs cursor-pointer ${s.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                          {s.is_active ? '停用' : '啟用'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 學校帳戶管理 ── */}
      {subTab === 'bank' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-800">學校帳戶管理</h2>
              <p className="text-sm text-gray-500 mt-1">管理各校的收款銀行帳戶資訊，可批次匯入或逐筆編輯。帳戶資料用於匯款清冊及撥款作業。</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">批次操作</p>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex flex-col gap-1">
                  <a href="/api/admin/import-bank"
                    className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-center">
                    ↓ 下載帳戶範本
                  </a>
                  <p className="text-xs text-gray-400 text-center">含所有啟用學校空白欄位</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`px-4 py-2 rounded-lg text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium cursor-pointer text-center ${bankUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {bankUploading ? '匯入中...' : '📥 批次匯入帳戶'}
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={bankUploading} onChange={handleImportBank} />
                  </label>
                  <p className="text-xs text-gray-400 text-center">上傳填妥的 Excel 批次更新</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={exportBankExcel}
                    className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white font-medium cursor-pointer">
                    📊 匯出帳戶彙整表
                  </button>
                  <p className="text-xs text-gray-400 text-center">匯出目前所有帳戶資料</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">各校帳戶資料</h3>
                <p className="text-xs text-gray-400 mt-0.5">點「編輯」可逐筆修改；帳戶資料需與學校印鑑一致</p>
              </div>
            </div>
            {loading ? (
              <p className="text-center text-gray-400 py-6 text-sm">載入中...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">學校名稱</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">銀行名稱</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">分行名稱</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">金融機構代碼</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">帳戶戶名</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">帳號</th>
                      <th className="text-center px-4 py-3 text-gray-500 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schools.filter(s => s.is_active).map(s => {
                      const bank = getBank(s.id, 1)
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{s.code}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                          <td className="px-4 py-3 text-gray-600">{bank?.bank_name || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{bank?.branch_name || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{bank?.bank_code || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{bank?.account_name || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{bank?.account_number || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => openBankEdit(s, 1)}
                              className="px-3 py-1 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer">
                              編輯
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 核定金額管理 ── */}
      {subTab === 'amounts' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-800">核定金額管理</h2>
              <p className="text-sm text-gray-500 mt-1">管理各校第1、第2學期核定補助金額，是計算結餘款、應繳回金額及匯款清冊的基礎數據，請確認金額正確後儲存。</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">批次匯入（{activeSchoolYear} 學年度）</p>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex flex-col gap-1">
                  <a href={`/api/admin/import-amounts?school_year=${activeSchoolYear}`}
                    className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-center">
                    ↓ 下載金額範本
                  </a>
                  <p className="text-xs text-gray-400 text-center">含所有學校的空白範本</p>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={`px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer text-center ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                    {importing ? '匯入中...' : '📥 批次匯入金額'}
                    <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing}
                      onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult('') }} />
                  </label>
                  <p className="text-xs text-gray-400 text-center">上傳填妥的 Excel 批次更新</p>
                </div>
                {importFile && !importing && (
                  <button onClick={handleImportAmounts}
                    className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white font-medium cursor-pointer">
                    確認上傳：{importFile.name}
                  </button>
                )}
              </div>
              {importResult && (
                <p className={`text-sm font-medium ${importResult.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>{importResult}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-800">各校核定金額</h3>
                <p className="text-xs text-gray-400 mt-0.5">點「✏️ 編輯核定金額」可直接在表格中修改，完成後點「儲存」</p>
              </div>
              {!editingAmounts ? (
                <button onClick={startEditAmounts}
                  className="px-4 py-2 rounded-lg text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium cursor-pointer whitespace-nowrap">
                  ✏️ 編輯核定金額
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={saveAmounts} disabled={savingAmounts}
                    className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium cursor-pointer">
                    {savingAmounts ? '儲存中...' : '✅ 儲存金額'}
                  </button>
                  <button onClick={() => setEditingAmounts(false)}
                    className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 font-medium cursor-pointer hover:bg-gray-50">
                    取消
                  </button>
                </div>
              )}
            </div>
            {loading ? (
              <p className="text-center text-gray-400 py-6 text-sm">載入中...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">區別</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">學校名稱</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">第1學期核定金額</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">第2學期核定金額</th>
                      <th className="text-right px-4 py-3 text-gray-500 font-medium">核定總金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schools.map(s => {
                      const amt = getAmount(s.id)
                      const sem1 = editingAmounts ? (Number(amountEdits[s.id]?.sem1) || 0) : (amt?.sem1_amount || 0)
                      const sem2 = editingAmounts ? (Number(amountEdits[s.id]?.sem2) || 0) : (amt?.sem2_amount || 0)
                      return (
                        <tr key={s.id} className={`hover:bg-gray-50 ${s.is_active ? '' : 'opacity-40'}`}>
                          <td className="px-4 py-3 text-gray-400">{s.code}</td>
                          <td className="px-4 py-3 text-gray-500">{s.district}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                          <td className="px-4 py-2 text-right">
                            {editingAmounts ? (
                              <input type="number" value={amountEdits[s.id]?.sem1 ?? ''}
                                onChange={e => setAmountEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], sem1: e.target.value } }))}
                                className="w-32 border border-blue-300 rounded px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-blue-500" />
                            ) : (
                              <span className="text-gray-700">{formatAmount(sem1)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {editingAmounts ? (
                              <input type="number" value={amountEdits[s.id]?.sem2 ?? ''}
                                onChange={e => setAmountEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], sem2: e.target.value } }))}
                                className="w-32 border border-blue-300 rounded px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-blue-500" />
                            ) : (
                              <span className="text-gray-700">{formatAmount(sem2)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-700">
                            {formatAmount(sem1 + sem2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-blue-50 border-t-2 border-blue-100">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700">全區合計</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">
                        {formatAmount(schools.reduce((acc, s) => acc + (editingAmounts ? (Number(amountEdits[s.id]?.sem1) || 0) : (getAmount(s.id)?.sem1_amount || 0)), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">
                        {formatAmount(schools.reduce((acc, s) => acc + (editingAmounts ? (Number(amountEdits[s.id]?.sem2) || 0) : (getAmount(s.id)?.sem2_amount || 0)), 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">
                        {formatAmount(schools.reduce((acc, s) => {
                          const a = getAmount(s.id)
                          const sem1 = editingAmounts ? (Number(amountEdits[s.id]?.sem1) || 0) : (a?.sem1_amount || 0)
                          const sem2 = editingAmounts ? (Number(amountEdits[s.id]?.sem2) || 0) : (a?.sem2_amount || 0)
                          return acc + sem1 + sem2
                        }, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 帳戶資訊 Modal */}
      {bankEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{bankEditing ? '編輯帳戶資訊' : '帳戶資訊'}</h2>
                <p className="text-sm text-gray-400">{bankEdit.schoolName}</p>
              </div>
              <button onClick={closeBankModal} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">✕</button>
            </div>
            {bankEditing ? (
              <>
                {([
                  { key: 'bank_name' as keyof BankEditState, label: '銀行名稱' },
                  { key: 'branch_name' as keyof BankEditState, label: '分行名稱' },
                  { key: 'bank_code' as keyof BankEditState, label: '金融機構代碼（7位）' },
                  { key: 'account_name' as keyof BankEditState, label: '帳戶戶名' },
                  { key: 'account_number' as keyof BankEditState, label: '帳號' },
                ]).map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                    <input type="text" value={(bankEdit as unknown as Record<string, string>)[f.key]}
                      onChange={e => setBankEdit(prev => prev ? { ...prev, [f.key]: e.target.value } : prev)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
                {bankError && <p className="text-sm text-red-600">{bankError}</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setBankEditing(false); setBankError('') }}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm cursor-pointer hover:bg-gray-50">取消</button>
                  <button onClick={saveBankEdit} disabled={bankSaving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-medium cursor-pointer">
                    {bankSaving ? '儲存中...' : '儲存'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700">
                  {bankFields.map(f => (
                    <div key={f.key} className="flex gap-2">
                      <span className="text-gray-400 w-28 flex-shrink-0">{f.label}</span>
                      <span className="font-medium">{(bankEdit as unknown as Record<string, string>)[f.key] || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={closeBankModal}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm cursor-pointer hover:bg-gray-50">關閉</button>
                  <button onClick={() => setBankEditing(true)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm font-medium cursor-pointer">編輯</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 帳號管理頁籤 ───────────────────────────────────────────────
function AccountsTab({ currentUserEmail }: { currentUserEmail: string }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContact, setEditContact] = useState({ name: '', title: '', phone: '' })
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [addError, setAddError] = useState('')
  const [search, setSearch] = useState('')
  // 登入紀錄
  interface LoginLog { id: string; email: string; school_name: string | null; is_admin: boolean; logged_in_at: string }
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [logSearch, setLogSearch] = useState('')
  const [logLoading, setLogLoading] = useState(true)

  function loadLogs(q = '') {
    setLogLoading(true)
    fetch(`/api/admin/login-logs?limit=200${q ? `&search=${encodeURIComponent(q)}` : ''}`)
      .then(r => r.json()).then(d => { setLogs(Array.isArray(d) ? d : []); setLogLoading(false) })
  }

  useEffect(() => {
    fetch('/api/admin/accounts').then(r => r.json()).then(data => {
      setAccounts(data)
      setLoading(false)
    })
    loadLogs()
  }, [])

  async function handleAddAdmin() {
    if (!newAdminEmail) return
    setAddingAdmin(true)
    setAddError('')
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newAdminEmail }),
    })
    const data = await res.json()
    if (!res.ok) {
      setAddError(data.error || '新增失敗')
    } else {
      setNewAdminEmail('')
      // refresh list
      const updated = await fetch('/api/admin/accounts').then(r => r.json())
      setAccounts(updated)
    }
    setAddingAdmin(false)
  }

  async function handleUnbind(email: string) {
    if (!confirm(`確定要解除 ${email} 的學校綁定？`)) return
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { school_id: null } }),
    })
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, school_id: null, schools: null } : a))
  }

  async function handleDelete(email: string) {
    if (!confirm(`確定要刪除帳號 ${email}？此操作無法復原。`)) return
    await fetch('/api/admin/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setAccounts(prev => prev.filter(a => a.email !== email))
  }

  async function handleToggleAdmin(email: string, isAdmin: boolean) {
    const action = isAdmin ? '設為管理員' : '撤銷管理員權限'
    if (!confirm(`確定要對 ${email} 執行「${action}」？`)) return
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { is_admin: isAdmin } }),
    })
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, is_admin: isAdmin } : a))
  }

  async function handleSaveContact(email: string) {
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, updates: { contact_name: editContact.name, contact_title: editContact.title, contact_phone: editContact.phone } }),
    })
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, contact_name: editContact.name, contact_title: editContact.title, contact_phone: editContact.phone } : a))
    setEditingId(null)
  }

  const [subTab, setSubTab] = useState<'schools' | 'admins' | 'logs'>('schools')

  if (loading) return <div className="text-center py-8 text-gray-400">載入中...</div>

  const adminAccounts = accounts.filter(a => a.is_admin)
  const schoolAccounts = accounts
    .filter(a => !a.is_admin)
    .filter(a => !search || a.email.includes(search) || a.schools?.name.includes(search) || String(a.schools?.code).includes(search))
    .sort((a, b) => (a.schools?.code ?? 9999) - (b.schools?.code ?? 9999))

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  return (
    <div className="space-y-4">
      {/* 子分頁切換 */}
      <div className="flex gap-2">
        <button className={subTabCls('schools')} onClick={() => setSubTab('schools')}>各校綁定帳號</button>
        <button className={subTabCls('admins')} onClick={() => setSubTab('admins')}>系統管理帳號</button>
        <button className={subTabCls('logs')} onClick={() => setSubTab('logs')}>登入紀錄</button>
      </div>

      {/* 各校綁定帳號 */}
      {subTab === 'schools' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
            <h2 className="font-semibold text-gray-800 whitespace-nowrap">各校綁定帳號</h2>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學校名稱、編號或 Email..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">#</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">綁定學校</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">承辦人 / 職稱 / 電話</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schoolAccounts.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{a.schools?.code ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {a.schools ? <span>{a.schools.district}・{a.schools.name}</span> : <span className="text-gray-300">未綁定</span>}
                  </td>
                  <td className="px-4 py-3">{a.email}</td>
                  <td className="px-4 py-3">
                    {editingId === a.id ? (
                      <div className="flex gap-2">
                        <input value={editContact.name} onChange={e => setEditContact(p => ({ ...p, name: e.target.value }))}
                          placeholder="姓名" className="border rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-blue-400" />
                        <input value={editContact.title} onChange={e => setEditContact(p => ({ ...p, title: e.target.value }))}
                          placeholder="職稱" className="border rounded px-2 py-1 text-xs w-20 outline-none focus:ring-1 focus:ring-blue-400" />
                        <input value={editContact.phone} onChange={e => setEditContact(p => ({ ...p, phone: e.target.value }))}
                          placeholder="電話" className="border rounded px-2 py-1 text-xs w-32 outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                    ) : (
                      <span className="text-gray-500">
                        {a.contact_name || '-'}
                        {a.contact_title ? `（${a.contact_title}）` : ''}
                        {a.contact_phone ? `　${a.contact_phone}` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      {editingId === a.id ? (
                        <>
                          <button onClick={() => handleSaveContact(a.email)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700">儲存</button>
                          <button onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">取消</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(a.id); setEditContact({ name: a.contact_name || '', title: a.contact_title || '', phone: a.contact_phone || '' }) }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200">編輯</button>
                          {a.school_id && (
                            <button onClick={() => handleUnbind(a.email)}
                              className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded cursor-pointer hover:bg-orange-200">解綁</button>
                          )}
                          <button onClick={() => handleToggleAdmin(a.email, true)}
                            className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded cursor-pointer hover:bg-purple-200">設管理員</button>
                          {a.email !== currentUserEmail && (
                            <button onClick={() => handleDelete(a.email)}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded cursor-pointer hover:bg-red-200">刪除</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 系統管理帳號 */}
      {subTab === 'admins' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">新增管理員帳號</p>
            <div className="flex gap-2">
              <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddAdmin()}
                placeholder="輸入 Gmail 帳號 (xxx@gmail.com)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddAdmin} disabled={addingAdmin || !newAdminEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg cursor-pointer">
                {addingAdmin ? '新增中...' : '新增管理員'}
              </button>
            </div>
            {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
            <p className="text-xs text-gray-400 mt-2">尚未登入過的帳號也可先行設定，該帳號首次登入後即可使用管理員身份</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-800">系統管理帳號</h2>
              <p className="text-xs text-gray-400 mt-0.5">已登入的帳號才會出現在此列表，可在此切換管理員權限</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">綁定學校</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">身份</th>
                  <th className="text-center px-4 py-3 text-gray-600 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adminAccounts.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.schools ? `${a.schools.name}（${a.schools.code}）` : <span className="text-gray-300">未綁定</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">管理員</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {a.email !== currentUserEmail && (
                        <button onClick={() => handleToggleAdmin(a.email, false)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded cursor-pointer hover:bg-red-200">撤銷管理員</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 登入紀錄 */}
      {subTab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
            <h2 className="font-semibold text-gray-800 whitespace-nowrap">登入紀錄</h2>
            <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadLogs(logSearch)}
              placeholder="搜尋 Email 或學校名稱…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={() => loadLogs(logSearch)}
              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer whitespace-nowrap">
              搜尋
            </button>
          </div>
          {logLoading ? (
            <p className="text-center text-gray-400 py-6 text-sm">載入中...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">無紀錄</p>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">登入時間</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">綁定學校</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">身份</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(l.logged_in_at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{l.email}</td>
                      <td className="px-4 py-2.5 text-gray-500">{l.school_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-center">
                        {l.is_admin
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">管理員</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">學校</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 系統設定頁籤 ───────────────────────────────────────────
interface Settings {
  system_name: string
  host_school: string
  school_year: string
  admin_name: string
  admin_title: string
  admin_phone: string
  plan_name: string
  manual_url: string
  drive_folder_id: string
  gas_url: string
  gas_secret: string
  notify_subject: string
  notify_body: string
  review_approve_subject: string
  review_approve_body: string
  review_reject_subject: string
  review_reject_body: string
  block1_open: string
  block1_deadline: string
  block2_open: string
  block2_deadline: string
  block3_open: string
  block3_deadline: string
}

// ── 學年度管理頁籤 ─────────────────────────────────────────
function SchoolYearTab({ activeSchoolYear, allSchoolYears }: { activeSchoolYear: string; allSchoolYears: string[] }) {
  const [years, setYears] = useState<string[]>(allSchoolYears)
  const [active, setActive] = useState(activeSchoolYear)
  const [newYear, setNewYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [backingUp, setBackingUp] = useState<string | null>(null)

  async function switchYear(y: string) {
    if (y === active) return
    if (!confirm(`確定要切換至 ${y} 學年度？儀表板資料將重新載入。`)) return
    setLoading(true)
    const res = await fetch('/api/admin/school-years', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch', schoolYear: y }),
    })
    if (res.ok) { setActive(y); setMsg(`已切換至 ${y} 學年度`); setTimeout(() => window.location.reload(), 1000) }
    else { const d = await res.json(); setMsg(`錯誤：${d.error}`) }
    setLoading(false)
  }

  async function addYear() {
    if (!newYear.trim()) return
    setLoading(true); setMsg('')
    const res = await fetch('/api/admin/school-years', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', schoolYear: newYear.trim() }),
    })
    const d = await res.json()
    if (res.ok) {
      setYears(prev => [...prev, newYear.trim()].sort().reverse())
      setActive(newYear.trim())
      setNewYear('')
      setMsg(`已新增並切換至 ${newYear.trim()} 學年度，頁面即將重新整理`)
      setTimeout(() => window.location.reload(), 1500)
    } else {
      setMsg(`錯誤：${d.error}`)
    }
    setLoading(false)
  }

  async function backup(y: string) {
    setBackingUp(y)
    const res = await fetch('/api/admin/school-years', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup', schoolYear: y }),
    })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${y}_backup.xlsx`; a.click()
    } else {
      const d = await res.json(); setMsg(`備份失敗：${d.error}`)
    }
    setBackingUp(null)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 目前學年度 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="text-sm text-blue-500 font-medium mb-1">目前作用中學年度</p>
        <p className="text-3xl font-bold text-blue-700">{active} 學年度</p>
        <p className="text-xs text-blue-400 mt-1">所有核銷資料（帳戶確認、結算表、送款憑單）均以此學年度為準</p>
      </div>

      {/* 學年度列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">學年度列表</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-2 text-gray-500 font-medium">學年度</th>
              <th className="text-center px-5 py-2 text-gray-500 font-medium">狀態</th>
              <th className="text-right px-5 py-2 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {years.map(y => (
              <tr key={y} className={active === y ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                <td className="px-5 py-3 font-medium text-gray-800">{y} 學年度</td>
                <td className="px-5 py-3 text-center">
                  {active === y
                    ? <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">作用中</span>
                    : <span className="bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full">歷史</span>
                  }
                </td>
                <td className="px-5 py-3 text-right flex justify-end gap-2">
                  {active !== y && (
                    <button onClick={() => switchYear(y)} disabled={loading}
                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg cursor-pointer">
                      切換
                    </button>
                  )}
                  <button onClick={() => backup(y)} disabled={backingUp === y}
                    className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg cursor-pointer">
                    {backingUp === y ? '匯出中...' : '📥 備份 Excel'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增學年度 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">新增學年度</h2>
        <p className="text-sm text-gray-500">新增後將自動切換至新學年度，學校帳號綁定沿用，帳戶與核銷資料重新開始</p>
        <div className="flex gap-3 items-center">
          <input value={newYear} onChange={e => setNewYear(e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder="例：116" maxLength={3}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm w-28 outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-sm text-gray-500">學年度</span>
          <button onClick={addYear} disabled={loading || newYear.length !== 3}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
            {loading ? '處理中...' : '新增並切換'}
          </button>
        </div>
        {msg && <p className={`text-sm font-medium ${msg.startsWith('錯誤') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
      </div>
    </div>
  )
}

// ── 系統設定頁籤 ───────────────────────────────────────────
function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [subTab, setSubTab] = useState<'basic' | 'blocks' | 'notify'>('basic')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (!data.error) {
        setSettings({
          plan_name: '',
          manual_url: '',
          review_approve_subject: '',
          review_approve_body: '',
          review_reject_subject: '',
          review_reject_body: '',
          ...data,
        })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaveError('')
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const d = await res.json()
      setSaveError(d.error || '儲存失敗')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  function set(k: keyof Settings, v: string) {
    setSettings(prev => prev ? { ...prev, [k]: v } : prev)
  }

  if (loading) return <div className="text-center py-8 text-gray-400">載入中...</div>
  if (!settings) return <div className="text-center py-8 text-red-400">讀取設定失敗，請重新整理</div>

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"

  const blocks: { label: string; openKey: keyof Settings; deadlineKey: keyof Settings }[] = [
    { label: '第1學期初（帳戶確認）', openKey: 'block1_open', deadlineKey: 'block1_deadline' },
    { label: '第1學期末（第1學期核銷）', openKey: 'block2_open', deadlineKey: 'block2_deadline' },
    { label: '第2學期末（第2學期核銷）', openKey: 'block3_open', deadlineKey: 'block3_deadline' },
  ]

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  const SaveBtn = () => (
    <div className="pt-2 space-y-2">
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <button onClick={handleSave} disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl cursor-pointer transition-colors">
        {saving ? '儲存中...' : saved ? '✅ 已儲存' : '儲存設定'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 子分頁切換 */}
      <div className="flex gap-2">
        <button className={subTabCls('basic')} onClick={() => setSubTab('basic')}>基本設定</button>
        <button className={subTabCls('blocks')} onClick={() => setSubTab('blocks')}>期程開放</button>
        <button className={subTabCls('notify')} onClick={() => setSubTab('notify')}>通知信範本</button>
      </div>

      {/* 基本設定 */}
      {subTab === 'basic' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系統名稱</label>
            <input value={settings.system_name} onChange={e => set('system_name', e.target.value)}
              className={inputCls} placeholder="台中市第2區 免費營養午餐核銷系統" />
            <p className="text-xs text-gray-400 mt-1">顯示於導覽列、登入頁及瀏覽器標題</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">承辦學校</label>
            <input value={settings.host_school} onChange={e => set('host_school', e.target.value)}
              className={inputCls} placeholder="例：臺中市神岡區社口國民小學" />
            <p className="text-xs text-gray-400 mt-1">顯示於登入頁；同時作為全區經費收支結算表抬頭</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">計畫名稱</label>
            <input value={settings.plan_name} onChange={e => set('plan_name', e.target.value)}
              className={inputCls} placeholder="例：115學年度公立國中小免費營養午餐計畫經費" />
            <p className="text-xs text-gray-400 mt-1">套用於各校及全區經費收支結算表；系統自動附加「（第X學期）」</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">承辦人姓名</label>
            <input value={settings.admin_name} onChange={e => set('admin_name', e.target.value)}
              className={inputCls} placeholder="林孟甫主任" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">承辦人職稱</label>
            <input value={settings.admin_title} onChange={e => set('admin_title', e.target.value)}
              className={inputCls} placeholder="主任" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
            <input value={settings.admin_phone} onChange={e => set('admin_phone', e.target.value)}
              className={inputCls} placeholder="(04)2562-6834 #730" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">學校端使用說明連結</label>
            <input value={settings.manual_url} onChange={e => set('manual_url', e.target.value)}
              className={inputCls} placeholder="https://..." />
            <p className="text-xs text-gray-400 mt-1">學校首頁將顯示此連結供下載使用說明 PDF</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive 上傳資料夾 ID</label>
            <input value={settings.drive_folder_id} onChange={e => set('drive_folder_id', e.target.value)}
              className={inputCls} placeholder="貼上 Google Drive 資料夾 ID" />
            <p className="text-xs text-gray-400 mt-1">從資料夾網址取得：drive.google.com/drive/folders/<span className="font-mono text-gray-600">此處為ID</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GAS 網址</label>
            <input value={settings.gas_url} onChange={e => set('gas_url', e.target.value)}
              className={inputCls} placeholder="https://script.google.com/macros/s/...../exec" />
            <p className="text-xs text-gray-400 mt-1">Google Apps Script 部署網址（上傳檔案、刪除檔案、寄信共用）</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GAS 驗證金鑰</label>
            <input value={settings.gas_secret} onChange={e => set('gas_secret', e.target.value)}
              className={inputCls} placeholder="自訂一組密碼（須與 GAS 腳本一致）" />
          </div>
          <SaveBtn />
        </div>
      )}

      {/* 區塊開放 */}
      {subTab === 'blocks' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <p className="text-sm text-gray-500">各區塊可單獨開放或關閉，關閉後學校畫面顯示「此階段尚未開放」。</p>
          {blocks.map(({ label, openKey, deadlineKey }) => (
            <div key={openKey} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">{label}</p>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">開放</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={settings[openKey] === 'true'}
                    onChange={e => set(openKey, e.target.checked ? 'true' : 'false')}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                </label>
                <span className={`text-sm font-medium ${settings[openKey] === 'true' ? 'text-green-600' : 'text-gray-400'}`}>
                  {settings[openKey] === 'true' ? '開放中' : '已關閉'}
                </span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">期限說明文字（顯示在學校畫面）</label>
                <input value={settings[deadlineKey]} onChange={e => set(deadlineKey, e.target.value)}
                  className={inputCls} placeholder="例：2026-02-15 或 學期末截止" />
              </div>
            </div>
          ))}
          <SaveBtn />
        </div>
      )}

      {/* 通知信範本 */}
      {subTab === 'notify' && (
        <div className="space-y-6">
          {/* 催收通知 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 border-b pb-2">催收通知</h2>
            <p className="text-xs text-gray-400">可使用變數：{['{schoolName}','{contactName}','{contactTitle}','{adminName}','{adminPhone}'].map(v => <span key={v} className="font-mono bg-gray-100 px-1 rounded mx-0.5">{v}</span>)}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
              <input value={settings.notify_subject} onChange={e => set('notify_subject', e.target.value)}
                className={inputCls} placeholder="【核銷系統】請儘速完成資料上傳" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
              <textarea value={settings.notify_body} onChange={e => set('notify_body', e.target.value)}
                rows={6} className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* 審核通過通知 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 border-b pb-2">✅ 審核通過通知</h2>
            <p className="text-xs text-gray-400">可使用變數：{['{contactName}','{contactTitle}','{schoolName}','{semLabel}','{typeLabel}','{actionNote}','{adminNote}'].map(v => <span key={v} className="font-mono bg-gray-100 px-1 rounded mx-0.5">{v}</span>)}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
              <input value={settings.review_approve_subject} onChange={e => set('review_approve_subject', e.target.value)}
                className={inputCls} placeholder="【核銷系統】{semLabel}申請已核准" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
              <textarea value={settings.review_approve_body} onChange={e => set('review_approve_body', e.target.value)}
                rows={6} className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* 審核拒絕通知 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 border-b pb-2">❌ 審核拒絕通知</h2>
            <p className="text-xs text-gray-400">可使用變數：{['{contactName}','{contactTitle}','{schoolName}','{semLabel}','{typeLabel}','{adminNote}'].map(v => <span key={v} className="font-mono bg-gray-100 px-1 rounded mx-0.5">{v}</span>)}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
              <input value={settings.review_reject_subject} onChange={e => set('review_reject_subject', e.target.value)}
                className={inputCls} placeholder="【核銷系統】{semLabel}申請未通過" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
              <textarea value={settings.review_reject_body} onChange={e => set('review_reject_body', e.target.value)}
                rows={6} className={`${inputCls} resize-none`} />
            </div>
          </div>

          <SaveBtn />
        </div>
      )}
    </div>
  )
}

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
