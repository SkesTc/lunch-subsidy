'use client'
import { useState } from 'react'
import { formatAmount } from '@/lib/utils'

interface School {
  id: number; code: number; district: string; name: string
  approved_total: number; sem1_amount: number; sem2_amount: number
}
interface BankRow { school_id: number; semester: number; confirmed_at: string | null; is_modified: boolean }
interface SettleRow {
  school_id: number; semester: number; status: string
  scan_file_path: string | null; remittance_file_path: string | null
  repay_amount: number; surplus: number
}

export default function AdminDashboardClient({
  schools, banks, settlements
}: { schools: School[]; banks: BankRow[]; settlements: SettleRow[] }) {
  const [sem, setSem] = useState<1 | 2>(1)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)

  const filtered = schools.filter(s =>
    s.name.includes(search) || s.district.includes(search) || String(s.code).includes(search)
  )

  function getBank(schoolId: number, semester: number) {
    return banks.find(b => b.school_id === schoolId && b.semester === semester)
  }
  function getSettle(schoolId: number, semester: number) {
    return settlements.find(s => s.school_id === schoolId && s.semester === semester)
  }

  const semSchools = filtered.map(s => ({
    school: s,
    bank: getBank(s.id, sem),
    settle: getSettle(s.id, sem),
  }))

  const stats = {
    bankDone: semSchools.filter(x => x.bank?.confirmed_at).length,
    bankModified: semSchools.filter(x => x.bank?.is_modified).length,
    scanDone: semSchools.filter(x => x.settle?.scan_file_path).length,
    remitDone: sem === 2 ? semSchools.filter(x => x.settle?.remittance_file_path).length : null,
    totalSurplus: semSchools.reduce((acc, x) => acc + (x.settle?.repay_amount || 0), 0),
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
    const a = document.createElement('a')
    a.href = url; a.download = `第${sem}學期_帳戶彙整.xlsx`; a.click()
  }

  async function exportSurplus() {
    const res = await fetch(`/api/admin/export?semester=${sem}&type=surplus`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `第${sem}學期_賸餘款彙整.xlsx`; a.click()
  }

  function StatusDot({ ok, label }: { ok: boolean; label: string }) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
        {ok ? '✓' : '○'} {label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">承辦後台</h1>
        <div className="flex gap-2">
          {([1, 2] as const).map(s => (
            <button key={s} onClick={() => setSem(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${sem === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
              第{s}學期
            </button>
          ))}
        </div>
      </div>

      {/* 統計卡 */}
      <div className={`grid gap-4 ${sem === 2 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <StatCard label="帳戶已確認" value={stats.bankDone} total={schools.length} warn={stats.bankModified > 0 ? `${stats.bankModified}校有修改` : ''} />
        <StatCard label="結算表已上傳" value={stats.scanDone} total={schools.length} />
        {sem === 2 && <StatCard label="送款憑單已上傳" value={stats.remitDone!} total={schools.length} />}
        <StatCard label="第2學期應繳回合計" value={`NT$ ${formatAmount(stats.totalSurplus)}`} isAmount />
      </div>

      {/* 工具列 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋學校名稱、區別、編號..."
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 outline-none focus:ring-2 focus:ring-blue-500" />

        <label className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          {uploading ? '匯入中...' : '📥 匯入帳戶資料 Excel'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </label>

        <button onClick={exportExcel}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
          📊 匯出帳戶彙整
        </button>

        <button onClick={exportSurplus}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
          💰 匯出賸餘款總表
        </button>

        <a href={`/api/admin/download-zip?semester=${sem}`}
          className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
          📦 下載所有掃描檔 ZIP
        </a>
      </div>

      {/* 學校清單 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium w-8">#</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">學校名稱</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">區別</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">核定金額</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">帳戶確認</th>
              <th className="text-center px-4 py-3 text-gray-600 font-medium">結算表</th>
              {sem === 2 && <th className="text-center px-4 py-3 text-gray-600 font-medium">送款憑單</th>}
              <th className="text-right px-4 py-3 text-gray-600 font-medium">應繳回</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {semSchools.map(({ school, bank, settle }) => (
              <tr key={school.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{school.code}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{school.name}</td>
                <td className="px-4 py-3 text-gray-500">{school.district}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {formatAmount(sem === 1 ? school.sem1_amount : school.sem2_amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusDot ok={!!bank?.confirmed_at} label={bank?.is_modified ? '已修改' : '確認'} />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusDot ok={!!settle?.scan_file_path} label="掃描檔" />
                </td>
                {sem === 2 && (
                  <td className="px-4 py-3 text-center">
                    {(settle?.surplus || 0) > 0
                      ? <StatusDot ok={!!settle?.remittance_file_path} label="憑單" />
                      : <span className="text-xs text-gray-300">無賸餘</span>
                    }
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
      </div>
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
