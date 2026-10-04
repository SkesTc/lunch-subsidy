'use client'
import { PLAN_STATUSES, PLAN_STATUS_LABELS, planStatusOf, semesterStatusesOf, type PlanStatus } from '@/lib/planStatus'
import { useDialog } from '@/components/DialogProvider'
import { useState, useEffect } from 'react'
import { BlockSpinner, Spinner } from '@/components/Spinner'

interface Plan {
  id: string; name: string; label: string; semester: number | null
  require_repay: boolean; deduct_s1_repay: boolean; sort_order: number; is_active: boolean
  deadline: string; school_year: string; is_open: boolean; open_note: string; status?: string | null
  semester_status?: Record<string, string> | null
  zone_ids: number[]; zone_id: number
}

interface Zone { id: number; name: string }

const emptyPlan = (): Omit<Plan, 'id' | 'school_year' | 'zone_id'> => ({
  name: '', label: '', semester: 1, require_repay: false, deduct_s1_repay: false,
  sort_order: 0, is_active: true, deadline: '', is_open: false, open_note: '', zone_ids: [], status: 'not_open', semester_status: {},
})

export default function PlansTab({ activeSchoolYear, isSuperAdmin, onPlansChanged, refreshToken }: { activeSchoolYear: string; isSuperAdmin: boolean; onPlansChanged?: () => void; refreshToken?: number }) {
  const dialog = useDialog()
  const [plans, setPlans] = useState<Plan[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState(emptyPlan())
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [msg, setMsg] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null)
  const [orderMsg, setOrderMsg] = useState('')

  function load(silent = false) {
    if (!silent) setLoading(true)
    fetch(`/api/admin/plans?school_year=${activeSchoolYear}`)
      .then(r => r.json()).then(d => { setPlans(Array.isArray(d) ? d : []); setLoading(false) })
  }

  // 從其他頁籤切回或按重新整理時，在背景更新資料（不切換到載入畫面）
  useEffect(() => {
    if (!refreshToken) return
    const t = setTimeout(() => load(true), 0)
    return () => clearTimeout(t)
  }, [refreshToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [activeSchoolYear])

  useEffect(() => {
    fetch('/api/admin/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []))
  }, [])

  function openAdd() { setEditing(null); setForm(emptyPlan()); setMsg(''); setShowModal(true) }
  function openEdit(p: Plan) {
    setEditing(p)
    setForm({
      name: p.name, label: p.label, semester: p.semester,
      require_repay: p.require_repay, deduct_s1_repay: p.deduct_s1_repay ?? false,
      sort_order: p.sort_order, is_active: p.is_active, deadline: p.deadline || '',
      is_open: p.is_open ?? false, open_note: p.open_note || '', status: planStatusOf(p), semester_status: semesterStatusesOf(p) ?? {},
      zone_ids: [...new Set((p.zone_ids || (p.zone_id ? [p.zone_id] : [])).map(Number))],
    })
    setMsg(''); setShowModal(true)
  }

  function toggleZone(zoneId: number) {
    setForm(f => ({
      ...f,
      zone_ids: f.zone_ids.includes(zoneId)
        ? f.zone_ids.filter(z => z !== zoneId)
        : [...f.zone_ids, zoneId],
    }))
  }

  async function handleSave() {
    if (!form.name || !form.label) { setMsg('請填寫計畫名稱和短標籤'); return }
    if (isSuperAdmin && form.zone_ids.length === 0) { setMsg('請選擇至少一個區別'); return }
    setSaving(true); setMsg('')
    const body = isSuperAdmin ? { ...form } : { ...form, zone_ids: undefined }
    const res = editing
      ? await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, ...body }) })
      : await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, school_year: activeSchoolYear, sort_order: (plans.length + 1) * 10 }) })
    const d = await res.json()
    if (res.ok) { setShowModal(false); load(); onPlansChanged?.() }
    else setMsg(d.error || '儲存失敗')
    setSaving(false)
  }

  // 拖拉排序：放開後立即儲存整串順序，失敗則重新載入
  async function saveOrder(next: Plan[]) {
    setPlans(next)
    setOrderMsg('儲存排序中…')
    const res = await fetch('/api/admin/plans/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(p => p.id) }),
    })
    if (res.ok) { setOrderMsg('已更新排序'); onPlansChanged?.(); setTimeout(() => setOrderMsg(''), 2000) }
    else {
      const d = await res.json().catch(() => ({}))
      setOrderMsg('')
      await dialog.alert({ title: '排序未儲存', message: d.error || `HTTP ${res.status}`, tone: 'error' })
      load()
    }
  }

  function moveTo(id: string, targetId: string, after: boolean) {
    if (id === targetId) return
    const rest = plans.filter(p => p.id !== id)
    const moving = plans.find(p => p.id === id)
    const idx = rest.findIndex(p => p.id === targetId)
    if (!moving || idx < 0) return
    rest.splice(after ? idx + 1 : idx, 0, moving)
    saveOrder(rest)
  }

  function moveBy(id: string, delta: number) {
    const i = plans.findIndex(p => p.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= plans.length) return
    const next = [...plans]
    ;[next[i], next[j]] = [next[j], next[i]]
    saveOrder(next)
    requestAnimationFrame(() => document.getElementById(`plan-handle-${id}`)?.focus())
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await fetch('/api/admin/plans', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteTarget.id }) })
    setDeleting(false)
    setDeleteTarget(null)
    if (res.ok) { load(); onPlansChanged?.() }
    else { const d = await res.json().catch(() => ({})); setMsg(d.error || '刪除失敗') }
  }

  async function handleSeed() {
    if (!(await dialog.confirm({ title: '建立預設計畫', message: '免費午餐補助、課後照顧補助、班班有冷氣', confirmLabel: '建立' }))) return
    setSeeding(true)
    await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed', school_year: activeSchoolYear }) })
    setSeeding(false); load(); onPlansChanged?.()
  }

  async function toggleActive(p: Plan) {
    await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) })
    load(); onPlansChanged?.()
  }

  async function setStatus(p: Plan, status: PlanStatus, sem?: number) {
    if (planStatusOf(p, sem) === status) return
    const target = `${p.label || p.name}${sem ? `・第${sem}學期` : ''}`
    if (status === 'closed' && !(await dialog.confirm({
      title: `將「${target}」設為已結案`,
      message: '結案後學校只能檢視已填報的金額與已上傳的檔案，無法再修改或上傳。之後仍可改回「已開放」。',
      confirmLabel: '設為已結案',
    }))) return
    const res = await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status, ...(sem ? { status_semester: sem } : {}) }) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      await dialog.alert({ title: '無法變更送件狀態', message: d.error || `HTTP ${res.status}`, tone: 'error' })
      return
    }
    load(); onPlansChanged?.()
  }

  if (loading) return <BlockSpinner />

  const semLabel = (s: number | null) => s === 1 ? '第1學期' : s === 2 ? '第2學期' : '全年'
  const zoneNames = (ids: number[]) => {
    if (!ids || ids.length === 0) return '—'
    // 舊資料可能混有文字格式或重複的分區代碼，先統一成數字並去重
    return [...new Set(ids.map(Number))].map(id => zones.find(z => z.id === id)?.name || `#${id}`).join('、')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">核銷計畫管理</h2>
          <p className="text-xs text-gray-400 mt-0.5">{activeSchoolYear} 學年度・共 {plans.length} 個計畫</p>
        </div>
        <div className="flex gap-2">
          {plans.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              className="px-4 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium cursor-pointer">
              {seeding ? <span className="flex items-center gap-2"><Spinner /> 建立中...</span> : '📋 建立預設計畫'}
            </button>
          )}
          <button onClick={openAdd}
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
            + 新增計畫
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p className="font-medium">尚無核銷計畫</p>
          <p className="text-sm mt-1">點「建立預設計畫」快速套用範例，或點「+ 新增計畫」自訂</p>
        </div>
      ) : (
        <div className="space-y-2">
        <p className="text-xs text-gray-500 flex items-center gap-3">
          <span>拖曳列表左側的 ⋮⋮ 可調整計畫順序，學校端與總覽會依此順序顯示。</span>
          {orderMsg && <span className={orderMsg.startsWith('已') ? 'text-green-600' : 'text-gray-400'}>{orderMsg}</span>}
        </p>
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-10 px-2 py-3"><span className="sr-only">排序</span></th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">計畫名稱</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">短標籤</th>
                {isSuperAdmin && <th className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">適用區別</th>}
                <th className="text-center px-4 py-3 text-gray-600 font-medium whitespace-nowrap">學期</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium whitespace-nowrap">繳回賸餘款</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">截止說明</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium whitespace-nowrap">送件狀態</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium whitespace-nowrap">啟用</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map(p => (
                <tr key={p.id}
                  onDragOver={e => {
                    if (!dragId) return
                    e.preventDefault()
                    const r = e.currentTarget.getBoundingClientRect()
                    setDropTarget({ id: p.id, after: e.clientY > r.top + r.height / 2 })
                  }}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragId && dropTarget) moveTo(dragId, dropTarget.id, dropTarget.after)
                    setDragId(null); setDropTarget(null)
                  }}
                  className={`hover:bg-gray-50 ${!p.is_active ? 'opacity-50' : ''} ${dragId === p.id ? 'opacity-40' : ''} ${
                    dropTarget?.id === p.id && dragId !== p.id ? (dropTarget.after ? 'shadow-[inset_0_-2px_0_0_#2563eb]' : 'shadow-[inset_0_2px_0_0_#2563eb]') : ''}`}>
                  <td className="px-2 py-3 text-center">
                    <button id={`plan-handle-${p.id}`} type="button" draggable
                      onDragStart={e => { setDragId(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id) }}
                      onDragEnd={() => { setDragId(null); setDropTarget(null) }}
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); moveBy(p.id, -1) }
                        if (e.key === 'ArrowDown') { e.preventDefault(); moveBy(p.id, 1) }
                      }}
                      aria-label={`調整「${p.label || p.name}」的順序（拖曳，或按上下鍵）`} title="拖曳調整順序，或聚焦後按 ↑ ↓"
                      className="inline-flex p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 min-w-[14rem]">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`${CHIP} bg-blue-50 text-blue-700 ring-blue-600/20`}>{p.label}</span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {zoneNames(p.zone_ids || (p.zone_id ? [p.zone_id] : []))}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">{semLabel(p.semester)}</td>
                  <td className="px-4 py-3 text-center">
                    {p.require_repay
                      ? <span className={`${CHIP} bg-amber-50 text-amber-800 ring-amber-600/25`}>須繳回</span>
                      : <span className={`${CHIP} bg-gray-50 text-gray-500 ring-gray-400/30`}>無須繳回</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs min-w-[8rem]">{p.deadline || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {(p.semester == null ? [1, 2] : [p.semester]).map(sem => (
                        <div key={sem} className="flex items-center gap-2">
                          <span className="w-14 text-xs text-gray-400 whitespace-nowrap">第{sem}學期</span>
                          <PlanStatusSwitch value={planStatusOf(p, p.semester == null ? sem : undefined)}
                            onChange={st => setStatus(p, st, p.semester == null ? sem : undefined)}
                            label={`${p.label || p.name}第${sem}學期送件狀態`} />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(p)} title={p.is_active ? '點擊停用' : '點擊啟用'}
                      className={`${CHIP} gap-1.5 cursor-pointer ${p.is_active ? 'bg-green-50 text-green-700 ring-green-600/20 hover:bg-green-100' : 'bg-gray-50 text-gray-500 ring-gray-400/30 hover:bg-gray-100'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden />
                      {p.is_active ? '啟用中' : '已停用'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 justify-center whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">編輯</button>
                      <button onClick={() => setDeleteTarget(p)} className="text-xs px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer">刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800">{editing ? '編輯計畫' : '新增計畫'}</h2>

            {/* 區別選擇（僅超級管理員） */}
            {isSuperAdmin && zones.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">適用區別 <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {zones.map(z => (
                    <label key={z.id} className="flex items-center gap-1.5 cursor-pointer text-sm border rounded-lg px-3 py-1.5 select-none"
                      style={{ borderColor: form.zone_ids.includes(z.id) ? '#3b82f6' : '#e5e7eb', background: form.zone_ids.includes(z.id) ? '#eff6ff' : '' }}>
                      <input type="checkbox" checked={form.zone_ids.includes(z.id)} onChange={() => toggleZone(z.id)} className="w-3.5 h-3.5" />
                      <span className={form.zone_ids.includes(z.id) ? 'text-blue-700 font-medium' : 'text-gray-600'}>{z.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">計畫名稱 <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：免費午餐補助" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">短標籤（用於表格欄位）<span className="text-red-500">*</span></label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="例：午餐S1（簡短即可）" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">學期</label>
                <select value={form.semester ?? ''} onChange={e => setForm(f => ({ ...f, semester: e.target.value === '' ? null : Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value={1}>第1學期</option>
                  <option value={2}>第2學期</option>
                  <option value="">全年</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">截止日期說明文字</label>
              <input value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                placeholder="例：2027-02-15" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開放說明（選填，顯示於學校端）</label>
              <input value={form.open_note} onChange={e => setForm(f => ({ ...f, open_note: e.target.value }))}
                placeholder="例：115學年度開學後開放" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              {form.semester == null ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <span className="font-medium text-gray-700">送件狀態</span>
                  {[1, 2].map(sem => (
                    <div key={sem} className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">第{sem}學期</span>
                      <PlanStatusSwitch value={planStatusOf(form, sem)}
                        onChange={st => setForm(f => ({ ...f, semester_status: { ...(semesterStatusesOf(f) ?? {}), [sem]: st } }))}
                        label={`第${sem}學期送件狀態`} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">送件狀態</span>
                  <PlanStatusSwitch value={planStatusOf(form)} onChange={st => setForm(f => ({ ...f, status: st, is_open: st === 'open' }))} label="送件狀態" />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.require_repay} onChange={e => setForm(f => ({ ...f, require_repay: e.target.checked }))} className="w-4 h-4 rounded" />
                須繳回賸餘款
              </label>
              {form.semester === null && (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.deduct_s1_repay} onChange={e => setForm(f => ({ ...f, deduct_s1_repay: e.target.checked }))} className="w-4 h-4 rounded" />
                  第1學期結餘扣抵第2學期
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded" />
                啟用
              </label>
            </div>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm cursor-pointer hover:bg-gray-50">取消</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer">
                {saving ? <span className="flex items-center justify-center gap-2"><Spinner /> 儲存中...</span> : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認 Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xl flex-shrink-0">⚠️</div>
              <h3 className="text-base font-bold text-gray-800">確認刪除計畫</h3>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
              <p className="text-sm font-semibold text-red-700">{deleteTarget.name}－{deleteTarget.label}</p>
              <p className="text-xs text-red-500">{deleteTarget.school_year} 學年度</p>
            </div>
            <p className="text-sm text-gray-600">
              刪除後將同時移除所有與此計畫相關的<span className="font-semibold text-red-600">核定金額設定</span>，且<span className="font-semibold">無法復原</span>。
            </p>
            <p className="text-xs text-gray-400">注意：已完成核銷的學校資料不受影響，但將無法再透過本計畫進行管理。</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm cursor-pointer hover:bg-gray-50 disabled:opacity-50">
                取消
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer">
                {deleting ? <span className="flex items-center justify-center gap-2"><Spinner />刪除中...</span> : '確認刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 列表內統一的標籤樣式（圓角膠囊、不換行）
const CHIP = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset'

const STATUS_ACTIVE: Record<PlanStatus, string> = {
  not_open: 'bg-white text-gray-700 shadow-sm',
  open: 'bg-green-600 text-white shadow-sm',
  closed: 'bg-slate-600 text-white shadow-sm',
}

// 三段式送件狀態切換：未開放／已開放／已結案
function PlanStatusSwitch({ value, onChange, label }: { value: PlanStatus; onChange: (s: PlanStatus) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
      {PLAN_STATUSES.map(st => (
        <button key={st} type="button" role="radio" aria-checked={value === st} onClick={() => onChange(st)}
          className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors ${value === st ? STATUS_ACTIVE[st] : 'text-gray-500 hover:text-gray-800'}`}>
          {PLAN_STATUS_LABELS[st]}
        </button>
      ))}
    </div>
  )
}
