'use client'
import { useState, useEffect } from 'react'
import { Spinner, BlockSpinner } from '@/components/Spinner'

interface SchoolFull { id: number; code: number; district: string; name: string; is_active: boolean; zone_id?: number }
interface BankRow { school_id: number; semester: number; bank_name: string | null; branch_name: string | null; bank_code: string | null; account_name: string | null; account_number: string | null }
interface BankEditState { schoolId: number; schoolName: string; semester: number; bank_name: string; branch_name: string; bank_code: string; account_name: string; account_number: string }
interface Zone { id: number; name: string }

export default function SchoolMgmtTab({ activeSchoolYear }: { activeSchoolYear: string }) {
  const [subTab, setSubTab] = useState<'list' | 'bank'>('list')
  const [schools, setSchools] = useState<SchoolFull[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newDistrict, setNewDistrict] = useState('')
  const [newName, setNewName] = useState('')
  const [newZoneId, setNewZoneId] = useState<number>(2)
  const [zones, setZones] = useState<Zone[]>([])
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  // 區別修改
  const [editingZone, setEditingZone] = useState<number | null>(null)
  const [zoneMsg, setZoneMsg] = useState('')
  // 刪除學校
  const [deleteSchool, setDeleteSchool] = useState<SchoolFull | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [forceDelete, setForceDelete] = useState(false)
  const [deleteCounts, setDeleteCounts] = useState<{ settlements: number; amounts: number; changeRequests: number; loginLogs: number } | null>(null)
  // CSV 批次匯入
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ ok?: boolean; inserted: number; updated: number; errors: string[] } | null>(null)
  // 帳戶 Excel 匯入／匯出
  const [bankSem, setBankSem] = useState<1 | 2>(1)
  const [bankUploading, setBankUploading] = useState(false)
  // 帳戶資訊 modal
  const [banks, setBanks] = useState<BankRow[]>([])
  const [bankEdit, setBankEdit] = useState<BankEditState | null>(null)
  const [bankEditing, setBankEditing] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [bankError, setBankError] = useState('')

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/schools-manage').then(r => r.json()),
      fetch('/api/admin/bank-edit').then(r => r.json()),
      fetch('/api/admin/zones').then(r => r.json()),
    ]).then(([schoolData, bankData, zonesData]) => {
      setSchools(schoolData as SchoolFull[])
      setBanks(Array.isArray(bankData) ? bankData as BankRow[] : [])
      setZones(Array.isArray(zonesData) ? zonesData as Zone[] : [])
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
      body: JSON.stringify({ code: Number(newCode), district: newDistrict, name: newName, zone_id: newZoneId }),
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

  async function changeZone(schoolId: number, zoneId: number) {
    await fetch('/api/admin/schools-manage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: schoolId, zone_id: zoneId }),
    })
    setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, zone_id: zoneId } : s))
    setEditingZone(null)
    setZoneMsg('✅ 已更新')
    setTimeout(() => setZoneMsg(''), 2000)
  }

  async function confirmDeleteSchool() {
    if (!deleteSchool) return
    setDeleting(true); setDeleteError('')
    const res = await fetch('/api/admin/schools-manage', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteSchool.id, force: forceDelete }),
    })
    setDeleting(false)
    if (res.ok) {
      setSchools(prev => prev.filter(s => s.id !== deleteSchool.id))
      setDeleteSchool(null); setForceDelete(false); setDeleteCounts(null)
    } else {
      const d = await res.json().catch(() => ({}))
      setDeleteError(d.error || '刪除失敗')
      if (d.counts) setDeleteCounts(d.counts)
    }
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvUploading(true); setCsvResult(null)
    const text = await file.text()
    const res = await fetch('/api/admin/import-schools', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    })
    const data = await res.json()
    setCsvResult(data)
    setCsvUploading(false)
    e.target.value = ''
    if (data.ok) load()
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

  const [zoneFilter, setZoneFilter] = useState<number | null>(null)
  const filtered = schools.filter(s => {
    if (search && !s.name.includes(search) && !String(s.code).includes(search)) return false
    if (zoneFilter !== null && s.zone_id !== zoneFilter) return false
    return true
  })
  const activeCount = schools.filter(s => s.is_active).length

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  const bankFields = [
    { key: 'bank_name' as keyof BankEditState, label: '銀行名稱' },
    { key: 'account_name' as keyof BankEditState, label: '帳戶名稱' },
    { key: 'bank_code' as keyof BankEditState, label: '局號' },
    { key: 'account_number' as keyof BankEditState, label: '帳號' },
  ]

  return (
    <div className="space-y-4">
      {/* 子分頁切換 */}
      <div className="flex gap-2">
        <button className={subTabCls('list')} onClick={() => setSubTab('list')}>學校清單管理</button>
        <button className={subTabCls('bank')} onClick={() => setSubTab('bank')}>學校帳戶管理</button>
      </div>

      {/* ── 學校清單管理 ── */}
      {subTab === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">學校清單管理</h2>
              <p className="text-sm text-gray-400 mt-0.5">啟用中 {activeCount} 校・共 {schools.length} 校</p>
            </div>
            <div className="flex gap-2 items-center">
              {zoneMsg && <span className="text-sm text-green-600">{zoneMsg}</span>}
              <a href="/api/admin/import-schools" className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">↓ CSV 範本</a>
              <label className={`px-3 py-2 rounded-lg text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium cursor-pointer ${csvUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {csvUploading ? '匯入中...' : '📥 批次匯入學校'}
                <input type="file" accept=".csv" className="hidden" disabled={csvUploading} onChange={handleImportCsv} />
              </label>
              <button onClick={() => { setShowAdd(!showAdd); setAddError('') }}
                className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer">
                + 新增學校
              </button>
            </div>
          </div>

          {showAdd && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-blue-800">新增學校</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">所屬區別</label>
                  <select value={newZoneId} onChange={e => setNewZoneId(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">編號</label>
                  <input type="number" value={newCode} onChange={e => setNewCode(e.target.value)}
                    placeholder="例：91" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">行政區</label>
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
                  {adding ? <span className='flex items-center gap-2'><Spinner /> 新增中...</span> : '確認新增'}
                </button>
              </div>
            </div>
          )}

          {csvResult && (
            <div className={`text-sm rounded-lg px-4 py-3 ${csvResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {csvResult.ok ? `✅ 新增 ${csvResult.inserted} 校・更新 ${csvResult.updated} 校` : '❌ 匯入失敗'}
              {csvResult.errors?.length > 0 && <ul className="mt-1 text-xs list-disc list-inside">{csvResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            </div>
          )}

          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學校名稱或編號..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={zoneFilter ?? ''} onChange={e => setZoneFilter(e.target.value === '' ? null : Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">所有區別</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>

          {loading ? (
            <BlockSpinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 rounded-lg">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">#</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">行政區</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">學校名稱</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">所屬區</th>
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
                      <td className="px-3 py-2.5">
                        {editingZone === s.id ? (
                          <div className="flex items-center gap-1">
                            <select defaultValue={s.zone_id || 2}
                              onChange={e => changeZone(s.id, Number(e.target.value))}
                              className="border border-blue-400 rounded px-2 py-1 text-xs outline-none">
                              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                            </select>
                            <button onClick={() => setEditingZone(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setEditingZone(s.id)}
                            className="text-xs text-blue-600 hover:underline cursor-pointer">
                            {zones.find(z => z.id === s.zone_id)?.name || `第${s.zone_id || 2}區`}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {s.is_active ? '啟用' : '停用'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => toggleActive(s)}
                            className={`px-3 py-1 rounded text-xs cursor-pointer ${s.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                            {s.is_active ? '停用' : '啟用'}
                          </button>
                          <button onClick={() => { setDeleteSchool(s); setDeleteError('') }}
                            className="px-3 py-1 rounded text-xs cursor-pointer bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600">
                            刪除
                          </button>
                        </div>
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
              <BlockSpinner />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">學校名稱</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">銀行名稱</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">帳戶名稱</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">局號</th>
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
                          <td className="px-4 py-3 text-gray-600">{bank?.account_name || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600 font-mono">{bank?.bank_code || <span className="text-gray-300">—</span>}</td>
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

      {/* 刪除學校確認 Modal */}
      {deleteSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-gray-800">確認刪除學校</h2>
            <p className="text-sm text-gray-600">
              確定要刪除「<span className="font-medium text-gray-800">{deleteSchool.name}</span>」？
            </p>
            {deleteError && (
              <div className="bg-red-50 rounded-lg p-3 space-y-2">
                <p className="text-sm text-red-600">{deleteError}</p>
                {deleteCounts && (
                  <ul className="text-xs text-red-500 list-disc list-inside">
                    {deleteCounts.settlements > 0 && <li>核銷記錄 {deleteCounts.settlements} 筆</li>}
                    {deleteCounts.amounts > 0 && <li>核定金額 {deleteCounts.amounts} 筆</li>}
                    {deleteCounts.changeRequests > 0 && <li>審核申請 {deleteCounts.changeRequests} 筆</li>}
                    {deleteCounts.loginLogs > 0 && <li>登入記錄 {deleteCounts.loginLogs} 筆</li>}
                  </ul>
                )}
                <label className="flex items-center gap-2 text-xs text-red-700 cursor-pointer mt-1">
                  <input type="checkbox" checked={forceDelete} onChange={e => setForceDelete(e.target.checked)} />
                  我了解後果，強制刪除以上所有資料
                </label>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setDeleteSchool(null); setForceDelete(false); setDeleteCounts(null); setDeleteError('') }} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                取消
              </button>
              <button onClick={confirmDeleteSchool} disabled={deleting || (!!deleteError && !forceDelete)}
                className="px-4 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 flex items-center gap-2">
                {deleting && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? '刪除中...' : forceDelete ? '強制刪除' : '確認刪除'}
              </button>
            </div>
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
                  { key: 'account_name' as keyof BankEditState, label: '帳戶名稱' },
                  { key: 'bank_code' as keyof BankEditState, label: '局號' },
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
