'use client'
import React, { useState, useEffect, useRef } from 'react'
import { SearchIcon, FolderIcon, DownloadIcon, ChevronDownIcon, MailIcon, TrashIcon } from '@/components/icons'
import { StatusChip } from '@/components/StatusChip'
import { useDialog } from '@/components/DialogProvider'
import { formatAmount } from '@/lib/utils'
import type { School, AmountRow, BankRow, SettleRow, ProfileRow, ContactInfo, Plan, PlanAmount } from '../types'
import { BatchPrintModal } from '../components/BatchPrintModal'
import { NotifyModal } from '../components/NotifyModal'
import { fileViewerUrl } from '../fileViewer'
import { PLAN_STATUS_LABELS, planStatusOf } from '@/lib/planStatus'

// ── 總覽頁籤 ───────────────────────────────────────────────
type StatusFilter = 'all' | 'done' | 'undone'

export default function OverviewTab({ schools, amounts: initAmounts, banks, settlements: initSettlements, profiles, contacts, activeSchoolYear, plans, planAmounts, driveFolderId, setDriveFolderId, driveFolderUrl, setDriveFolderUrl }: {
  schools: School[]; amounts: AmountRow[]; banks: BankRow[]; settlements: SettleRow[]; profiles: ProfileRow[]; contacts: Record<string, ContactInfo>; activeSchoolYear: string
  plans: Plan[]; planAmounts: PlanAmount[]
  driveFolderId: string; setDriveFolderId: (v: string) => void; driveFolderUrl: string; setDriveFolderUrl: (v: string) => void
}) {
  const dialog = useDialog()
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
  const [bindFilter, setBindFilter] = useState<StatusFilter>('all')
  const [scanFilter, setScanFilter] = useState<StatusFilter>('all')
  const [remitFilter, setRemitFilter] = useState<StatusFilter>('all')
  const [expenseFilter, setExpenseFilter] = useState<StatusFilter>('all')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [batchPrint, setBatchPrint] = useState<'scan' | 'remittance' | null>(null)
  const [hostSchool, setHostSchool] = useState('')
  const [planName, setPlanName] = useState('')
  const [settlements, setSettlements] = useState<SettleRow[]>(initSettlements)
  const [amounts] = useState<AmountRow[]>(initAmounts)
  // account change requests
  interface ChangeRequest { school_id: number; school_name: string; school_code: number; school_year: string; status: string; new_info: Record<string, string>; file_id: string; submitted_at: string; admin_note: string }
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  // checkboxes
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // delete file confirm modal
  // notify modal
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyToast, setNotifyToast] = useState('')

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

  useEffect(() => {
    if (!showExportMenu) return
    const onDown = (e: MouseEvent) => { if (!exportMenuRef.current?.contains(e.target as Node)) setShowExportMenu(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowExportMenu(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [showExportMenu])

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
    const hasExpense = (x.settle?.total_expense || 0) > 0
    const matchExpense = expenseFilter === 'all' ? true : expenseFilter === 'done' ? hasExpense : !hasExpense
    return matchZone && matchDistrict && matchSearch && matchBind && matchScan && matchRemit && matchExpense
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

  async function handleDeleteFile(settlementId: number, fileType: 'scan' | 'remittance') {
    const label = fileType === 'scan' ? '經費收支結算表掃描檔' : '賸餘款送款憑單'
    if (!(await dialog.confirm({ title: `刪除${label}`, message: '刪除後學校需重新上傳，此操作無法復原。', confirmLabel: '刪除', danger: true }))) return
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
    } else {
      const data = await res.json().catch(() => ({}))
      await dialog.alert({ title: '刪除失敗', message: String(data.error || `HTTP ${res.status}`), tone: 'error' })
    }
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
                <div className="flex items-start justify-between gap-2">
                  <div className={`text-xs font-semibold ${sel ? 'text-blue-100' : 'text-gray-500'}`}>{plan.name}</div>
                  {planStatusOf(plan) !== 'open' && (
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${sel ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {PLAN_STATUS_LABELS[planStatusOf(plan)]}
                    </span>
                  )}
                </div>
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {zoneIds.length > 1 && (
            <select value={zoneFilter ?? ''} onChange={e => setZoneFilter(e.target.value === '' ? null : Number(e.target.value))}
              aria-label="分區" className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">全部分區</option>
              {zoneIds.map(id => <option key={id} value={id}>{zonesMap[id] || `分區 ${id}`}</option>)}
            </select>
          )}
          <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} aria-label="行政區" className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">全部行政區</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <label className="relative inline-flex items-center">
            <SearchIcon size={14} className="absolute left-2.5 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜尋學校名稱或編號" aria-label="搜尋學校"
              className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm w-52 outline-none focus:ring-2 focus:ring-blue-500" />
          </label>

          <span className="flex-1" />

          {(driveFolderUrl || driveFolderId) ? (
            <a href={driveFolderUrl || `https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <FolderIcon /> 雲端資料夾
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 cursor-default" title="請先在系統設定填入 Google Drive 資料夾 ID">
              <FolderIcon /> 雲端資料夾
            </span>
          )}

          <div className="relative" ref={exportMenuRef}>
            <button onClick={() => setShowExportMenu(v => !v)} aria-haspopup="true" aria-expanded={showExportMenu}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:border-gray-400 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <DownloadIcon /> 匯出 <ChevronDownIcon />
            </button>
            {showExportMenu && (
              <div role="menu" className="absolute right-0 top-full mt-1.5 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[240px] p-1.5">
                <p className="px-2.5 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wide text-gray-400">清冊（Excel）</p>
                {[
                  { label: '全部', bank: '' },
                  { label: '臺灣銀行', bank: 'taiwan' },
                  { label: '非臺灣銀行', bank: 'other' },
                ].map(({ label, bank }) => (
                  <a key={bank} role="menuitem"
                    href={`/api/admin/export-remittance?semester=${effectiveSem}${selectedPlan ? `&plan_id=${selectedPlan.id}` : ''}${bank ? `&bank=${bank}` : ''}`}
                    onClick={() => setShowExportMenu(false)}
                    className="flex justify-between gap-3 px-2.5 py-1.5 rounded-md text-sm text-gray-700 hover:bg-blue-50">
                    匯款清冊 <span className="text-gray-400">{label}</span>
                  </a>
                ))}
                <button role="menuitem" onClick={() => { setShowExportMenu(false); exportSurplus() }}
                  className="block w-full text-left px-2.5 py-1.5 rounded-md text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">賸餘款清冊</button>
                <hr className="my-1.5 border-gray-100" />
                <p className="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-gray-400">列印</p>
                <button role="menuitem" onClick={() => { setShowExportMenu(false); openSummaryPrint() }}
                  className="block w-full text-left px-2.5 py-1.5 rounded-md text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">全區經費收支結算表</button>
                <hr className="my-1.5 border-gray-100" />
                <p className="px-2.5 pt-1 pb-0.5 text-[11px] font-semibold tracking-wide text-gray-400">批次合併 PDF（每 50 校一份）</p>
                {[
                  { label: '經費收支結算表', type: 'scan' as const },
                  { label: '賸餘款送款憑單', type: 'remittance' as const },
                ].map(({ label, type }) => (
                  <button key={type} role="menuitem" onClick={() => { setShowExportMenu(false); setBatchPrint(type) }}
                    className="block w-full text-left px-2.5 py-1.5 rounded-md text-sm text-gray-700 hover:bg-blue-50 cursor-pointer">{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-blue-50 rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-700">已選 <b>{selected.size}</b> 校</span>
            <span className="flex-1" />
            <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-blue-100 cursor-pointer">取消選取</button>
            <button onClick={() => setNotifyOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
              <MailIcon /> 寄送催收通知
            </button>
          </div>
        )}
      </div>
      {batchPrint && (
        <BatchPrintModal type={batchPrint} semester={effectiveSem} planId={selectedPlan?.id ?? null} schoolYear={activeSchoolYear} onClose={() => setBatchPrint(null)} />
      )}

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
              <th className="text-right px-4 py-3 text-gray-600 font-medium">實支金額 <FilterSelect value={expenseFilter} onChange={setExpenseFilter} /></th>
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
                    <StatusChip tone="missing">未綁定</StatusChip>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const pendingScan = settleRequests.find(r => r.school_id === school.id && (selectedPlan ? r.plan_id === selectedPlan.id : r.semester === sem) && (r.request_type === 'scan_upload' || r.request_type === 'scan_reupload') && r.status === 'pending')
                    return (
                      <div className="flex flex-col items-center gap-0.5">
                        {settle?.scan_file_path ? (
                          <div className="flex items-center gap-0.5">
                            <StatusChip tone="done" href={fileViewerUrl(settle.scan_file_path, { name: `${school.name}・經費收支結算表` })} title="開啟檔案">已上傳</StatusChip>
                            <button onClick={() => settle.id && handleDeleteFile(settle.id, 'scan')} aria-label="刪除結算表掃描檔" title="刪除檔案"
                              className="p-1 rounded text-gray-300 hover:text-red-600 hover:bg-red-50 cursor-pointer"><TrashIcon /></button>
                          </div>
                        ) : !pendingScan && (
                          <StatusChip tone="missing">未上傳</StatusChip>
                        )}
                        {pendingScan && (
                          <StatusChip tone="pending">{pendingScan.request_type === 'scan_upload' ? '首次上傳待審' : '重新上傳待審'}</StatusChip>
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
                                  <div className="flex items-center gap-0.5">
                                    <StatusChip tone="done" href={fileViewerUrl(settle.remittance_file_path, { name: `${school.name}・送款憑單` })} title="開啟檔案">已上傳</StatusChip>
                                    <button onClick={() => settle.id && handleDeleteFile(settle.id, 'remittance')} aria-label="刪除送款憑單" title="刪除檔案"
                                      className="p-1 rounded text-gray-300 hover:text-red-600 hover:bg-red-50 cursor-pointer"><TrashIcon /></button>
                                  </div>
                                  {settle.remittance_date && (
                                    <span className="text-xs text-gray-400">{settle.remittance_date}</span>
                                  )}
                                </div>
                              : !pendingRemit && <StatusChip tone="missing">未上傳</StatusChip>
                            : <StatusChip tone="na">無需繳回</StatusChip>
                          }
                          {pendingRemit && (
                            <StatusChip tone="pending">{pendingRemit.request_type === 'remittance_upload' ? '首次上傳待審' : '重新上傳待審'}</StatusChip>
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
          <div className="text-center py-10 space-y-2">
            <p className="text-sm text-gray-500">沒有符合目前篩選條件的學校</p>
            <button onClick={() => {
              setSearch(''); setDistrictFilter(''); setZoneFilter(null)
              setBindFilter('all'); setScanFilter('all'); setRemitFilter('all'); setExpenseFilter('all')
            }} className="text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer">清除所有篩選</button>
          </div>
        )}
      </div>

      {notifyOpen && (
        <NotifyModal
          targets={allSemSchools.filter(x => selected.has(x.school.id)).map(x => ({
            id: x.school.id, code: x.school.code, name: x.school.name, bound: x.boundEmails.length > 0,
            hasExpense: (x.settle?.total_expense || 0) > 0, scanUploaded: !!x.settle?.scan_file_path,
            remitUploaded: !!x.settle?.remittance_file_path, repayAmount: x.settle?.repay_amount || 0,
          }))}
          semester={effectiveSem}
          planId={selectedPlan?.id ?? null}
          remitApplies={selectedPlan ? selectedPlan.require_repay && !(selectedPlan.deduct_s1_repay && effectiveSem === 1) : effectiveSem === 2}
          planStatus={selectedPlan ? planStatusOf(selectedPlan) : null}
          onClose={() => setNotifyOpen(false)}
          onNarrow={ids => setSelected(new Set(ids))}
          onSent={(ok, total) => {
            setNotifyOpen(false)
            setNotifyToast(`✅ 催收通知已寄出 ${ok} / ${total} 封`)
            setTimeout(() => setNotifyToast(''), 4000)
          }}
        />
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
