'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, calcRatio, calcSurplus, calcRepay, semLabel } from '@/lib/utils'

interface SchoolInfo {
  name: string
  district: string
  sem1_amount: number
  sem2_amount: number
}

export default function SettlementPage() {
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) as 1 | 2
  const router = useRouter()
  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [personnel, setPersonnel] = useState('')
  const [business, setBusiness] = useState('')
  const [equipment, setEquipment] = useState('')
  const [existing, setExisting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/schools/me').then(r => r.json()),
      fetch(`/api/settlement?semester=${semester}`).then(r => r.json()),
    ]).then(([s, st]) => {
      setSchool(s)
      if (st) {
        setPersonnel(String(st.personnel_expense || ''))
        setBusiness(String(st.business_expense || ''))
        setEquipment(String(st.equipment_expense || ''))
        setExisting(st)
      }
      setLoading(false)
    })
  }, [semester])

  if (loading || !school) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">載入中...</div>
  )

  const approvedAmount = semester === 1 ? school.sem1_amount : school.sem2_amount
  const p = Number(personnel) || 0
  const b = Number(business) || 0
  const e = Number(equipment) || 0
  const D = p + b + e
  const A = approvedAmount
  const B = approvedAmount  // 本例全額補助
  const C = calcRatio(B, A)
  const E = calcSurplus(A, D)
  const F = D > 0 ? calcRepay(E, C) : 0
  const hasSurplus = E > 0

  async function handleSaveAndDownload() {
    setSaving(true)
    const res = await fetch('/api/settlement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        semester,
        personnel_expense: p,
        business_expense: b,
        equipment_expense: e,
      }),
    })
    if (res.ok) {
      const params = new URLSearchParams({
        sem: String(semester),
        schoolName: school?.name ?? '',
        A: String(A), B: String(B), C: String(C),
        D: String(D), E: String(E), F: String(F),
        p: String(p), b: String(b), eq: String(e),
      })
      window.open(`/settlement-print?${params}`, '_blank')
    }
    setSaving(false)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/school" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">第{semester}學期・填寫實支金額</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">填寫實支金額</h1>
            <p className="text-sm text-gray-500 mt-1">{semLabel(semester)}・{school.name}</p>
          </div>

          {/* 核定金額（唯讀） */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700 font-medium">A. 核定計畫金額</span>
              <span className="font-bold text-blue-800">NT$ {formatAmount(A)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">B. 核定補助金額</span>
              <span className="font-bold">NT$ {formatAmount(B)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">C. 補助比率 (B/A)</span>
              <span className="font-bold">{(C * 100).toFixed(2)}%</span>
            </div>
          </div>

          {/* 輸入實支 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">D. 實支總額（請填寫各項目）</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">人事費（經常門）</label>
                <input type="number" min="0" value={personnel}
                  onChange={e => setPersonnel(e.target.value)}
                  className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">業務費（經常門）</label>
                <input type="number" min="0" value={business}
                  onChange={e => setBusiness(e.target.value)}
                  className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">設備及投資（資本門）</label>
                <input type="number" min="0" value={equipment}
                  onChange={e => setEquipment(e.target.value)}
                  className={inputClass} placeholder="0" />
              </div>
            </div>
          </div>

          {/* 自動計算結果 */}
          {D > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-200">
              <div className="flex justify-between font-semibold">
                <span>D. 實支總額合計</span>
                <span>NT$ {formatAmount(D)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">E. 計畫結餘款 (A-D)</span>
                <span className={hasSurplus ? 'text-orange-600 font-medium' : 'text-green-600'}>
                  NT$ {formatAmount(E)}
                </span>
              </div>
              {hasSurplus && (
                <div className="flex justify-between">
                  <span className="text-red-600">F. 應繳回本局 (E×C，無條件進位)</span>
                  <span className="text-red-600 font-bold">NT$ {formatAmount(F)}</span>
                </div>
              )}
              {semester === 2 && hasSurplus && (
                <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-orange-600">
                  ⚠ 有賸餘款 NT$ {formatAmount(F)} 需繳回公庫，請完成繳款後上傳送款憑單
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSaveAndDownload}
            disabled={saving || D === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? '處理中...' : '儲存並下載經費收支結算表 PDF'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            下載後請列印、蓋章，再至下一步上傳掃描檔
          </p>
        </div>
      </div>
    </div>
  )
}
