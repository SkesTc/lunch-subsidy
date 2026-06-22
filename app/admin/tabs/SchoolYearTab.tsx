'use client'
import { useState, useEffect } from 'react'
import { Spinner, BlockSpinner } from '@/components/Spinner'

export default function SchoolYearTab() {
  const [years, setYears] = useState<string[]>([])
  const [active, setActive] = useState('')
  const [newYear, setNewYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [backingUp, setBackingUp] = useState<string | null>(null)
  const [clearing, setClearing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/school-years').then(r => r.json()).then(d => {
      if (d.years) setYears(d.years)
      if (d.active) setActive(d.active)
      setLoading(false)
    })
  }, [])

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

  async function clearReviews(y: string) {
    if (!confirm(`確定要清除 ${y} 學年度所有審核紀錄？\n\n此操作不可復原，將刪除該學年度的所有申請審核記錄（含實支金額修改、檔案上傳/重新上傳申請）。`)) return
    setClearing(y); setMsg('')
    const res = await fetch('/api/admin/school-years', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear-reviews', schoolYear: y }),
    })
    const d = await res.json()
    if (res.ok) setMsg(`✓ 已清除 ${y} 學年度審核紀錄（共 ${d.deleted} 筆）`)
    else setMsg(`錯誤：${d.error}`)
    setClearing(null)
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

  if (loading) return <BlockSpinner />

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <p className="text-sm text-blue-500 font-medium mb-1">目前作用中學年度</p>
        <p className="text-3xl font-bold text-blue-700">{active} 學年度</p>
        <p className="text-xs text-blue-400 mt-1">所有核銷資料（帳戶確認、結算表、送款憑單）均以此學年度為準</p>
      </div>

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
                    : <span className="bg-gray-100 text-gray-400 text-xs px-2 py-0.5 rounded-full">歷史</span>}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {active !== y && (
                      <button onClick={() => switchYear(y)} disabled={loading}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg cursor-pointer">
                        切換
                      </button>
                    )}
                    <button onClick={() => backup(y)} disabled={backingUp === y}
                      className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg cursor-pointer">
                      {backingUp === y ? <span className="flex items-center gap-1"><Spinner /> 匯出中...</span> : '📥 備份'}
                    </button>
                    <button onClick={() => clearReviews(y)} disabled={clearing === y}
                      className="text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1 rounded-lg cursor-pointer">
                      {clearing === y ? <span className="flex items-center gap-1"><Spinner /> 清除中...</span> : '🗑 清審核'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
            {loading ? <span className="flex items-center gap-2"><Spinner /> 處理中...</span> : '新增並切換'}
          </button>
        </div>
        {msg && <p className={`text-sm font-medium ${msg.startsWith('錯誤') ? 'text-red-600' : 'text-green-600'}`}>{msg}</p>}
      </div>
    </div>
  )
}
