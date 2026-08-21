'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { formatAmount } from '@/lib/utils'
import { Spinner, BlockSpinner } from '@/components/Spinner'
import type { Plan } from '../AdminDashboardClient'
const PlansTab = dynamic(() => import('./PlansTab'), { loading: () => <BlockSpinner /> })
const NotifyTab = dynamic(() => import('./NotifyTab'), { loading: () => <BlockSpinner /> })

export default function SchoolsTab({ activeSchoolYear, plans, isSuperAdmin, onPlansChanged }: { activeSchoolYear: string; plans: Plan[]; isSuperAdmin: boolean; onPlansChanged?: () => void }) {
  interface SchoolFull { id: number; code: number; district: string; name: string; is_active: boolean; zone_id?: number | null }
  interface ZoneOption { id: number; name: string }
  const [schools, setSchools] = useState<SchoolFull[]>([])
  const [loading, setLoading] = useState(true)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')
  // 核定金額編輯
  interface AmountRow { school_id: number; sem1_amount: number; sem2_amount: number }
  const [amounts, setAmounts] = useState<AmountRow[]>([])
  const [editingAmounts, setEditingAmounts] = useState(false)
  const [amountEdits, setAmountEdits] = useState<Record<number, { sem1: string; sem2: string }>>({})
  const [savingAmounts, setSavingAmounts] = useState(false)
  // 計畫核定金額 planAmountData[planId][schoolId] = { 1?: amount, 2?: amount }
  const [planAmountData, setPlanAmountData] = useState<Record<string, Record<number, { 1?: number; 2?: number }>>>({})
  const [planAmountEdits, setPlanAmountEdits] = useState<Record<string, Record<number, { s1: string; s2: string }>>>({})
  const [editingPlanAmounts, setEditingPlanAmounts] = useState(false)
  const [savingPlanAmounts, setSavingPlanAmounts] = useState(false)
  // 批次匯入狀態，key = `planId_semester`
  const [planImporting, setPlanImporting] = useState<Record<string, boolean>>({})
  const [planImportResult, setPlanImportResult] = useState<Record<string, string>>({})
  // 區別篩選
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [zoneFilter, setZoneFilter] = useState<number | null>(null)

  function load() {
    setLoading(true)
    const fetches: Promise<unknown>[] = [
      fetch('/api/admin/schools-manage').then(r => r.json()),
      fetch(`/api/admin/amounts?school_year=${activeSchoolYear}`).then(r => r.json()),
    ]
    if (plans.length > 0) {
      fetches.push(fetch(`/api/admin/plan-amounts?school_year=${activeSchoolYear}`).then(r => r.json()))
    }
    Promise.all(fetches).then(([schoolData, amountData, paData]) => {
      setSchools(schoolData as SchoolFull[])
      setAmounts(Array.isArray(amountData) ? amountData as AmountRow[] : [])
      if (Array.isArray(paData)) {
        const map: Record<string, Record<number, { 1?: number; 2?: number }>> = {}
        for (const row of paData as { plan_id: string; school_id: number; semester: number; amount: number }[]) {
          if (!map[row.plan_id]) map[row.plan_id] = {}
          if (!map[row.plan_id][row.school_id]) map[row.plan_id][row.school_id] = {}
          map[row.plan_id][row.school_id][row.semester as 1 | 2] = row.amount
        }
        setPlanAmountData(map)
      }
      setLoading(false)
    })
  }

  async function handlePlanImport(planId: string, semester: number, file: File) {
    const key = `${planId}_${semester}`
    setPlanImporting(p => ({ ...p, [key]: true }))
    setPlanImportResult(p => ({ ...p, [key]: '' }))
    const fd = new FormData()
    fd.append('file', file)
    fd.append('plan_id', planId)
    fd.append('semester', String(semester))
    fd.append('school_year', activeSchoolYear)
    const res = await fetch('/api/admin/plan-amounts', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setPlanImportResult(p => ({ ...p, [key]: `✓ 已更新 ${data.updated} 筆${data.errors?.length ? `，${data.errors.length} 筆失敗` : ''}` }))
      load()
    } else {
      setPlanImportResult(p => ({ ...p, [key]: `✗ ${data.error || '匯入失敗'}` }))
    }
    setPlanImporting(p => ({ ...p, [key]: false }))
  }

  async function savePlanAmounts() {
    setSavingPlanAmounts(true)
    const rows: { plan_id: string; school_id: number; semester: number; amount: number }[] = []
    for (const [planId, schoolMap] of Object.entries(planAmountEdits)) {
      const plan = plans.find(p => p.id === planId)
      const isFullYear = plan?.semester == null
      for (const [schoolIdStr, vals] of Object.entries(schoolMap)) {
        const sid = Number(schoolIdStr)
        if (isFullYear || plan?.semester === 1) rows.push({ plan_id: planId, school_id: sid, semester: 1, amount: Number(vals.s1) || 0 })
        if (isFullYear || plan?.semester === 2) rows.push({ plan_id: planId, school_id: sid, semester: 2, amount: Number(vals.s2) || 0 })
      }
    }
    await fetch('/api/admin/plan-amounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_year: activeSchoolYear, rows }),
    })
    setPlanAmountData(prev => {
      const next = { ...prev }
      for (const row of rows) {
        if (!next[row.plan_id]) next[row.plan_id] = {}
        if (!next[row.plan_id][row.school_id]) next[row.plan_id][row.school_id] = {}
        next[row.plan_id][row.school_id][row.semester as 1 | 2] = row.amount
      }
      return next
    })
    setEditingPlanAmounts(false)
    setPlanAmountEdits({})
    setSavingPlanAmounts(false)
  }
  useEffect(() => {
    load()
    if (isSuperAdmin) {
      fetch('/api/admin/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []))
    }
  }, [])

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

  const [subTab, setSubTab] = useState<'amounts' | 'plans' | 'notify'>('plans')

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  return (
    <div className="space-y-4">
      {/* 子分頁切換 */}
      <div className="flex gap-2">
        <button className={subTabCls('plans')} onClick={() => setSubTab('plans')}>核銷計畫管理</button>
        <button className={subTabCls('amounts')} onClick={() => setSubTab('amounts')}>核定金額管理</button>
        <button className={subTabCls('notify')} onClick={() => setSubTab('notify')}>通知信範本</button>
      </div>

      {/* ── 核銷計畫 ── */}
      {subTab === 'plans' && <PlansTab activeSchoolYear={activeSchoolYear} isSuperAdmin={isSuperAdmin} onPlansChanged={onPlansChanged} />}

      {/* ── 通知信範本 ── */}
      {subTab === 'notify' && <NotifyTab isSuperAdmin={isSuperAdmin} />}

      {/* ── 核定金額管理 ── */}
      {subTab === 'amounts' && (
        <div className="space-y-4">
          {/* 有計畫時：直接顯示計畫金額；無計畫時：顯示學期金額 */}
          {plans.length === 0 && (<>
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
              <BlockSpinner />
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
          </>)} {/* end plans.length === 0 */}

          {/* 有計畫時：批次匯入 + 金額總覽表 */}
          {plans.length > 0 && (
            <div className="space-y-4">
              {/* 批次匯入區 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-gray-800">核定金額管理</h2>
                  <p className="text-sm text-gray-500 mt-1">依計畫下載範本，填寫各校核定金額後批次匯入。全學年計畫請分第1、第2學期分別匯入。</p>
                </div>
                <div className="space-y-3">
                  {plans.map(plan => {
                    const isFullYear = plan.semester == null
                    const sems: number[] = isFullYear ? [1, 2] : [plan.semester ?? 1]
                    return (
                      <div key={plan.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm">{plan.name}</span>
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-mono">{plan.label}</span>
                          {isFullYear && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">全學年</span>}
                        </div>
                        {sems.map(sem => {
                          const key = `${plan.id}_${sem}`
                          const isImporting = planImporting[key] || false
                          const result = planImportResult[key] || ''
                          const semLabel = isFullYear ? `第${sem}學期` : '全學期'
                          const templateUrl = `/api/admin/plan-amounts?template=1&plan_id=${plan.id}&semester=${sem}&school_year=${activeSchoolYear}`
                          return (
                            <div key={sem} className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                              <span className="text-xs font-semibold text-gray-500 w-16">{semLabel}</span>
                              <a href={templateUrl}
                                className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">
                                ↓ 下載範本
                              </a>
                              <label className={`px-3 py-1.5 text-xs rounded-lg font-medium cursor-pointer ${isImporting ? 'bg-gray-200 text-gray-400 pointer-events-none' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                                {isImporting ? <span className="flex items-center gap-1"><Spinner /> 匯入中...</span> : '📥 批次匯入'}
                                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={isImporting}
                                  onChange={e => {
                                    const f = e.target.files?.[0]
                                    if (f) handlePlanImport(plan.id, sem, f)
                                    e.target.value = ''
                                  }} />
                              </label>
                              {result && (
                                <span className={`text-xs font-medium ${result.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>{result}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 金額總覽表（可編輯） */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">各校核定金額總覽</h3>
                    <p className="text-xs text-gray-400 mt-0.5">匯入後即時更新；也可點「✏️ 編輯金額」直接修改</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {isSuperAdmin && zones.length > 0 && (
                      <select value={zoneFilter ?? ''} onChange={e => setZoneFilter(e.target.value === '' ? null : Number(e.target.value))}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">全部區別</option>
                        {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                    )}
                    {editingPlanAmounts ? (
                      <>
                        <button onClick={() => { setEditingPlanAmounts(false); setPlanAmountEdits({}) }}
                          className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg cursor-pointer hover:bg-gray-50">取消</button>
                        <button onClick={savePlanAmounts} disabled={savingPlanAmounts}
                          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium cursor-pointer">
                          {savingPlanAmounts ? '儲存中...' : '儲存'}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => {
                        const init: Record<string, Record<number, { s1: string; s2: string }>> = {}
                        for (const plan of plans) {
                          init[plan.id] = {}
                          for (const s of schools) {
                            const d = planAmountData[plan.id]?.[s.id] || {}
                            init[plan.id][s.id] = { s1: String(d[1] ?? 0), s2: String(d[2] ?? 0) }
                          }
                        }
                        setPlanAmountEdits(init)
                        setEditingPlanAmounts(true)
                      }} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium cursor-pointer">
                        ✏️ 編輯金額
                      </button>
                    )}
                  </div>
                </div>
                {loading ? <BlockSpinner /> : (
                  <div className="overflow-x-auto">
                    {(() => {
                      const cols: { planId: string; label: string; sem: 1 | 2 }[] = []
                      for (const p of plans) {
                        if (p.semester === null || p.semester === 1) cols.push({ planId: p.id, label: p.semester === null ? `${p.label} S1` : p.label, sem: 1 })
                        if (p.semester === null || p.semester === 2) cols.push({ planId: p.id, label: p.semester === null ? `${p.label} S2` : p.label, sem: 2 })
                      }
                      const getAmt = (planId: string, schoolId: number, sem: 1 | 2) =>
                        editingPlanAmounts
                          ? (sem === 1 ? planAmountEdits[planId]?.[schoolId]?.s1 : planAmountEdits[planId]?.[schoolId]?.s2) ?? '0'
                          : String(planAmountData[planId]?.[schoolId]?.[sem] ?? 0)
                      const getAmtNum = (planId: string, schoolId: number, sem: 1 | 2) => Number(getAmt(planId, schoolId, sem)) || 0
                      const activeSchools = schools.filter(s =>
                        s.is_active && (zoneFilter === null || s.zone_id === zoneFilter)
                      )
                      const zoneNameMap = Object.fromEntries(zones.map(z => [z.id, z.name]))
                      return (
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                              {isSuperAdmin && zones.length > 0 && <th className="text-left px-4 py-3 text-gray-500 font-medium">區別</th>}
                              <th className="text-left px-4 py-3 text-gray-500 font-medium">學校名稱</th>
                              {cols.map((c, i) => (
                                <th key={i} className="text-right px-4 py-3 text-gray-500 font-medium">{c.label}</th>
                              ))}
                              <th className="text-right px-4 py-3 text-gray-500 font-medium">合計</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {activeSchools.map(s => {
                              const total = cols.reduce((acc, c) => acc + getAmtNum(c.planId, s.id, c.sem), 0)
                              return (
                                <tr key={s.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-400">{s.code}</td>
                                  {isSuperAdmin && zones.length > 0 && (
                                    <td className="px-4 py-3 text-xs text-gray-500">
                                      {s.zone_id ? (zoneNameMap[s.zone_id] || `#${s.zone_id}`) : '—'}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                                  {cols.map((c, i) => (
                                    <td key={i} className="px-4 py-2 text-right">
                                      {editingPlanAmounts ? (
                                        <input type="number" value={getAmt(c.planId, s.id, c.sem)}
                                          onChange={e => setPlanAmountEdits(prev => ({
                                            ...prev,
                                            [c.planId]: { ...prev[c.planId], [s.id]: { ...prev[c.planId]?.[s.id], [c.sem === 1 ? 's1' : 's2']: e.target.value } }
                                          }))}
                                          className="w-28 border border-blue-300 rounded px-2 py-1 text-sm text-right outline-none focus:ring-1 focus:ring-blue-500" />
                                      ) : (
                                        <span className="text-gray-700">{formatAmount(getAmtNum(c.planId, s.id, c.sem))}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-4 py-3 text-right font-semibold text-blue-700">{formatAmount(total)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-blue-50 border-t-2 border-blue-100">
                            <tr>
                              <td colSpan={isSuperAdmin && zones.length > 0 ? 3 : 2} className="px-4 py-3 font-semibold text-gray-700">
                                {zoneFilter ? `${zoneNameMap[zoneFilter] || ''} 合計` : '全區合計'}
                              </td>
                              {cols.map((c, i) => (
                                <td key={i} className="px-4 py-3 text-right font-bold text-gray-800">
                                  {formatAmount(activeSchools.reduce((acc, s) => acc + getAmtNum(c.planId, s.id, c.sem), 0))}
                                </td>
                              ))}
                              <td className="px-4 py-3 text-right font-bold text-blue-700">
                                {formatAmount(activeSchools.reduce((acc, s) => acc + cols.reduce((sum, c) => sum + getAmtNum(c.planId, s.id, c.sem), 0), 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
