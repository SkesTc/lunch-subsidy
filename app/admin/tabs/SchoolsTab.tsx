'use client'
import { useState, useEffect } from 'react'
import { formatAmount } from '@/lib/utils'
import { Spinner, BlockSpinner } from '@/components/Spinner'

export default function SchoolsTab({ activeSchoolYear }: { activeSchoolYear: string }) {
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
                  {adding ? <span className='flex items-center gap-2'><Spinner /> 新增中...</span> : '確認新增'}
                </button>
              </div>
            </div>
          )}

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋學校名稱或編號..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />

          {loading ? (
            <BlockSpinner />
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
              <BlockSpinner />
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

