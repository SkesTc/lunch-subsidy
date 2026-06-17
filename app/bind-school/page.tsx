'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SCHOOLS_DATA } from '@/lib/schools-data'

export default function BindSchoolPage() {
  const router = useRouter()
  const [selectedCode, setSelectedCode] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const districts = Array.from(new Set(SCHOOLS_DATA.map(s => s.district)))

  async function handleBind() {
    if (!selectedCode) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/account/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolCode: selectedCode }),
    })
    if (res.ok) {
      router.push('/school')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || '綁定失敗，請聯絡承辦人員')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="text-3xl mb-2">🏫</div>
          <h1 className="text-xl font-bold text-gray-800">選擇您的學校</h1>
          <p className="text-sm text-gray-500 mt-1">首次登入需綁定學校，綁定後不可自行更改</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">選擇學校</label>
          <select
            value={selectedCode}
            onChange={e => setSelectedCode(Number(e.target.value) || '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">-- 請選擇學校 --</option>
            {districts.map(district => (
              <optgroup key={district} label={district}>
                {SCHOOLS_DATA.filter(s => s.district === district).map(s => (
                  <option key={s.code} value={s.code}>
                    {s.code}. {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {selectedCode && (() => {
          const school = SCHOOLS_DATA.find(s => s.code === selectedCode)
          if (!school) return null
          return (
            <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
              <p className="font-semibold text-blue-800">{school.name}</p>
              <p className="text-blue-600">{school.district}・編號 {school.code}</p>
              <div className="mt-2 pt-2 border-t border-blue-200 space-y-1 text-blue-700">
                <p>第1學期核定：<span className="font-medium">NT$ {school.sem1_amount.toLocaleString()}</span></p>
                <p>第2學期核定：<span className="font-medium">NT$ {school.sem2_amount.toLocaleString()}</span></p>
              </div>
            </div>
          )
        })()}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
        )}

        <button
          onClick={handleBind}
          disabled={!selectedCode || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? '綁定中...' : '確認綁定'}
        </button>

        <p className="text-xs text-center text-gray-400">
          如綁定錯誤請聯絡承辦學校：(04)2562-6834 #730
        </p>
      </div>
    </div>
  )
}
