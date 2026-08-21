'use client'
import { useState, useEffect } from 'react'
import { BlockSpinner, Spinner } from '@/components/Spinner'

interface Plan {
  id: string; name: string; label: string; semester: number | null
  require_repay: boolean; deduct_s1_repay: boolean; sort_order: number; is_active: boolean
  deadline: string; school_year: string; is_open: boolean; open_note: string
  zone_ids: number[]; zone_id: number
}

interface Zone { id: number; name: string }

const emptyPlan = (): Omit<Plan, 'id' | 'school_year' | 'zone_id'> => ({
  name: '', label: '', semester: 1, require_repay: false, deduct_s1_repay: false,
  sort_order: 0, is_active: true, deadline: '', is_open: false, open_note: '', zone_ids: [],
})

export default function PlansTab({ activeSchoolYear, isSuperAdmin, onPlansChanged }: { activeSchoolYear: string; isSuperAdmin: boolean; onPlansChanged?: () => void }) {
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

  function load() {
    setLoading(true)
    fetch(`/api/admin/plans?school_year=${activeSchoolYear}`)
      .then(r => r.json()).then(d => { setPlans(Array.isArray(d) ? d : []); setLoading(false) })
  }

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
      is_open: p.is_open ?? false, open_note: p.open_note || '',
      zone_ids: p.zone_ids || (p.zone_id ? [p.zone_id] : []),
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
      : await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, school_year: activeSchoolYear }) })
    const d = await res.json()
    if (res.ok) { setShowModal(false); load(); onPlansChanged?.() }
    else setMsg(d.error || '儲存失敗')
    setSaving(false)
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
    if (!confirm('建立預設計畫（免費午餐補助、課後照顧補助、班班有冷氣）？')) return
    setSeeding(true)
    await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'seed', school_year: activeSchoolYear }) })
    setSeeding(false); load(); onPlansChanged?.()
  }

  async function toggleActive(p: Plan) {
    await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_active: !p.is_active }) })
    load(); onPlansChanged?.()
  }

  async function toggleOpen(p: Plan) {
    await fetch('/api/admin/plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_open: !p.is_open }) })
    load(); onPlansChanged?.()
  }

  if (loading) return <BlockSpinner />

  const semLabel = (s: number | null) => s === 1 ? '第1學期' : s === 2 ? '第2學期' : '全年'
  const zoneNames = (ids: number[]) => {
    if (!ids || ids.length === 0) return '—'
    return ids.map(id => zones.find(z => z.id === id)?.name || `#${id}`).join('、')
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">計畫名稱</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">短標籤</th>
                {isSuperAdmin && <th className="text-left px-4 py-3 text-gray-600 font-medium">適用區別</th>}
                <th className="text-center px-4 py-3 text-gray-600 font-medium">學期</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">繳回賸餘款</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">截止說明</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">開放送件</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">啟用</th>
                <th className="text-center px-4 py-3 text-gray-600 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{p.label}</span>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {zoneNames(p.zone_ids || (p.zone_id ? [p.zone_id] : []))}
                    </td>
                  )}
                  <td className="px-4 py-3 text-center text-gray-600">{semLabel(p.semester)}</td>
                  <td className="px-4 py-3 text-center">
                    {p.require_repay
                      ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">須繳回</span>
                      : <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">無須繳回</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.deadline || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleOpen(p)}
                      className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${p.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {p.is_open ? '開放中' : '關閉'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(p)}
                      className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                      {p.is_active ? '啟用' : '停用'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => openEdit(p)} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded cursor-pointer">編輯</button>
                      <button onClick={() => setDeleteTarget(p)} className="text-xs px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 rounded cursor-pointer">刪除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.is_open} onChange={e => setForm(f => ({ ...f, is_open: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="font-medium text-green-700">開放學校送件</span>
              </label>
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
