'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'select' | 'contact'
interface SchoolItem { id: number; code: number; district: string; name: string }

export default function BindSchoolPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('select')
  const [schools, setSchools] = useState<SchoolItem[]>([])
  const [selectedCode, setSelectedCode] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [conflictEmail, setConflictEmail] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  useEffect(() => {
    fetch('/api/schools/list').then(r => r.json()).then(setSchools).catch(() => {})
  }, [])

  const districts = Array.from(new Set(schools.map(s => s.district)))

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
      setStep('contact')
    } else {
      const data = await res.json()
      if (res.status === 409) {
        setConflictEmail(data.existingEmail || '')
        setError(data.error || '此學校已被其他帳號綁定')
      } else {
        setConflictEmail('')
        setError(data.error || '綁定失敗，請聯絡承辦人員')
      }
    }
    setLoading(false)
  }

  async function handleSaveContact() {
    if (!contactName || !contactPhone) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/account/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactName, contactTitle, contactPhone }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || '儲存失敗，請重試')
        setLoading(false)
        return
      }
    } catch {
      // 網路錯誤仍導向，但顯示提示
    }
    setLoading(false)
    window.location.href = '/school'
  }

  if (step === 'contact') {
    const school = schools.find(s => s.code === selectedCode)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-lg space-y-6">
          <div className="text-center">
            <div className="text-3xl mb-2">✅</div>
            <h1 className="text-xl font-bold text-gray-800">綁定成功！</h1>
            <p className="text-sm text-gray-500 mt-1">{school?.name}</p>
            <p className="text-sm text-gray-500 mt-1">請填寫學校承辦人聯絡資訊</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">承辦人姓名</label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                placeholder="請輸入承辦人姓名"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">職稱</label>
              <input type="text" value={contactTitle} onChange={e => setContactTitle(e.target.value)}
                placeholder="例：組長、主任、幹事"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
              <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                placeholder="例：04-12345678 #123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}
          <button onClick={handleSaveContact} disabled={loading || !contactName || !contactPhone}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
            {loading ? '儲存中...' : '儲存並進入系統'}
          </button>
          {(!contactName || !contactPhone) && (
            <p className="text-xs text-gray-400 text-center">請填寫承辦人姓名與聯絡電話後繼續</p>
          )}
        </div>
      </div>
    )
  }

  const selectedSchool = schools.find(s => s.code === selectedCode)

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
          <select value={selectedCode} onChange={e => setSelectedCode(Number(e.target.value) || '')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
            <option value="">-- 請選擇學校 --</option>
            {districts.map(district => (
              <optgroup key={district} label={district}>
                {schools.filter(s => s.district === district).map(s => (
                  <option key={s.code} value={s.code}>{s.code}. {s.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {selectedSchool && (
          <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-blue-800">{selectedSchool.name}</p>
            <p className="text-blue-600">{selectedSchool.district}・編號 {selectedSchool.code}</p>
          </div>
        )}

        {error && !conflictEmail && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
        )}
        {conflictEmail && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-red-700">此學校已有帳號綁定</p>
            <p className="text-sm text-red-600">已綁定帳號：<span className="font-mono font-medium">{conflictEmail}</span></p>
            <p className="text-xs text-red-400 mt-1">如需變更，請聯絡承辦學校請管理員解除原帳號綁定後再重試。</p>
          </div>
        )}

        <button onClick={handleBind} disabled={!selectedCode || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
          {loading ? '綁定中...' : '確認綁定'}
        </button>

        <p className="text-xs text-center text-gray-400">
          如綁定錯誤請聯絡承辦學校：(04)2562-6834 #730
        </p>
      </div>
    </div>
  )
}
