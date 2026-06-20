'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { validateBankCode } from '@/lib/utils'
import LoadingSpinner from '@/components/LoadingSpinner'

interface BankForm {
  bank_name: string
  branch_name: string
  bank_code: string
  account_name: string
  account_number: string
}

const empty: BankForm = {
  bank_name: '', branch_name: '', bank_code: '',
  account_name: '', account_number: '',
}

export default function BankPage() {
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) as 1 | 2
  const router = useRouter()
  const [form, setForm] = useState<BankForm>(empty)
  const [isPreloaded, setIsPreloaded] = useState(false)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [bankCodeError, setBankCodeError] = useState('')

  useEffect(() => {
    fetch(`/api/account?semester=${semester}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setForm({
            bank_name: data.bank_name || '',
            branch_name: data.branch_name || '',
            bank_code: data.bank_code || '',
            account_name: data.account_name || '',
            account_number: data.account_number || '',
          })
          setIsPreloaded(data.is_preloaded)
          setConfirmedAt(data.confirmed_at)
        }
        setLoading(false)
      })
  }, [semester])

  function set(k: keyof BankForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'bank_code') {
      setBankCodeError(v && !validateBankCode(v) ? '請輸入7位數字代碼' : '')
    }
  }

  async function handleSubmit() {
    if (!validateBankCode(form.bank_code)) { setBankCodeError('請輸入7位數字代碼'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semester, ...form }),
    })
    if (res.ok) {
      router.push('/school')
    } else {
      setError('儲存失敗，請再試一次')
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  const fields: { key: keyof BankForm; label: string; placeholder: string; hint?: string }[] = [
    { key: 'bank_name', label: '銀行名稱', placeholder: '例：臺灣銀行' },
    { key: 'branch_name', label: '分行名稱', placeholder: '例：豐原分行' },
    { key: 'bank_code', label: '金融機構代碼', placeholder: '7位數字', hint: '共7碼，例：0040303' },
    { key: 'account_name', label: '帳戶戶名', placeholder: '保管金專戶全銜' },
    { key: 'account_number', label: '帳號', placeholder: '存帳帳號' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/school" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">第{semester}學期・帳戶資訊確認</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">帳戶資訊確認</h1>
            <p className="text-sm text-gray-500 mt-1">115學年度第{semester}學期・請確認匯款帳戶資訊</p>
          </div>

          {isPreloaded && !confirmedAt && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              以下為承辦學校預載資料，請核對是否正確。如有誤請直接修改後確認。
            </div>
          )}

          {confirmedAt && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
              ✓ 已於 {new Date(confirmedAt).toLocaleString('zh-TW')} 確認完畢
            </div>
          )}

          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {f.label} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {f.key === 'bank_code' && bankCodeError && (
                  <p className="text-red-500 text-xs mt-1">{bankCodeError}</p>
                )}
                {f.hint && !bankCodeError && (
                  <p className="text-gray-400 text-xs mt-1">{f.hint}</p>
                )}
              </div>
            ))}
          </div>

          {/* 格式預覽 */}
          {form.bank_name && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1 border border-gray-200">
              <p className="font-medium text-gray-600 mb-2 text-xs">領據帳戶資訊預覽</p>
              <p>金融機構：{form.bank_name} {form.branch_name}</p>
              <p>金融機構代碼：{form.bank_code}</p>
              <p>帳戶名稱：{form.account_name}</p>
              <p>帳　　號：{form.account_number}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? '確認中...' : confirmedAt ? '更新並確認' : '確認帳戶資訊'}
          </button>
        </div>
      </div>
    </div>
  )
}
