'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { validateBankCode } from '@/lib/utils'

interface BankForm {
  bank_name: string; branch_name: string; bank_code: string
  account_name: string; account_number: string
}
const empty: BankForm = { bank_name: '', branch_name: '', bank_code: '', account_name: '', account_number: '' }

interface ChangeRequest { status: string; submitted_at: string; reviewed_at: string | null; admin_note: string; new_info: BankForm }

export default function AccountChangePage() {
  const router = useRouter()
  const [current, setCurrent] = useState<BankForm | null>(null)
  const [form, setForm] = useState<BankForm>(empty)
  const [file, setFile] = useState<File | null>(null)
  const [existing, setExisting] = useState<ChangeRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bankCodeError, setBankCodeError] = useState('')

  useEffect(() => {
    fetch('/api/school/account-status')
      .then(r => r.json())
      .then(({ bankAccount, pendingRequest }) => {
        if (bankAccount) setCurrent({ bank_name: bankAccount.bank_name, branch_name: bankAccount.branch_name, bank_code: bankAccount.bank_code, account_name: bankAccount.account_name, account_number: bankAccount.account_number })
        if (pendingRequest) setExisting(pendingRequest)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function set(k: keyof BankForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'bank_code') setBankCodeError(v && !validateBankCode(v) ? '請輸入7位數字代碼' : '')
  }

  async function handleSubmit() {
    if (!validateBankCode(form.bank_code)) { setBankCodeError('請輸入7位數字代碼'); return }
    if (!file) { setError('請上傳帳戶資訊圖檔'); return }
    setSubmitting(true); setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('file', file)
    const res = await fetch('/api/account/change-request', { method: 'POST', body: fd })
    if (res.ok) {
      router.push('/school')
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || '送出失敗，請再試一次')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const statusMap: Record<string, { label: string; color: string }> = {
    pending:  { label: '審核中', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    approved: { label: '已核准', color: 'text-green-700 bg-green-50 border-green-200' },
    rejected: { label: '已拒絕', color: 'text-red-700 bg-red-50 border-red-200' },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/school" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">帳戶資訊變更申請</span>
        </div>

        <div className="space-y-5">
          {/* 目前帳戶資訊 */}
          {current && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
              <h2 className="font-semibold text-gray-700">目前帳戶資訊</h2>
              <div className="text-sm text-gray-600 space-y-1 bg-gray-50 rounded-xl p-4">
                <p>金融機構：{current.bank_name} {current.branch_name}</p>
                <p>金融機構代碼：{current.bank_code}</p>
                <p>帳戶名稱：{current.account_name}</p>
                <p>帳　　號：{current.account_number}</p>
              </div>
            </div>
          )}

          {/* 現有申請狀態 */}
          {existing && (
            <div className={`rounded-2xl border p-5 space-y-2 ${statusMap[existing.status]?.color || ''}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">申請狀態：{statusMap[existing.status]?.label}</span>
                <span className="text-xs opacity-70">{new Date(existing.submitted_at).toLocaleString('zh-TW')}</span>
              </div>
              {existing.admin_note && <p className="text-sm">備註：{existing.admin_note}</p>}
              {existing.status === 'pending' && <p className="text-sm opacity-70">已送出申請，請等待審核。若需重新送出請填寫下方表單。</p>}
              {existing.status === 'approved' && <p className="text-sm">帳戶資訊已更新，如需再次修改請重新送出申請。</p>}
            </div>
          )}

          {/* 申請表單 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-gray-800">
                {existing?.status === 'pending' ? '重新送出申請' : '申請變更帳戶資訊'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">請填寫正確的新帳戶資訊，並上傳存摺封面或開戶資料掃描圖檔</p>
            </div>

            {[
              { key: 'bank_name', label: '銀行名稱', placeholder: '例：臺灣銀行' },
              { key: 'account_name', label: '帳戶名稱', placeholder: '保管金專戶全銜' },
              { key: 'bank_code', label: '局號', placeholder: '7位數字，例：0040303' },
              { key: 'account_number', label: '帳號', placeholder: '存帳帳號' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} <span className="text-red-500">*</span></label>
                <input type="text" value={form[f.key as keyof BankForm]}
                  onChange={e => set(f.key as keyof BankForm, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                {f.key === 'bank_code' && bankCodeError && <p className="text-red-500 text-xs mt-1">{bankCodeError}</p>}
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">帳戶資訊圖檔 <span className="text-red-500">*</span></label>
              <p className="text-xs text-gray-400 mb-2">請上傳存摺封面或開戶資料掃描檔（JPG / PNG / PDF）</p>
              <div onClick={() => document.getElementById('changeFile')?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors">
                {file ? (
                  <div className="space-y-1">
                    <div className="text-2xl">📄</div>
                    <p className="font-medium text-gray-700 text-sm">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div className="space-y-1 text-gray-400">
                    <div className="text-2xl">⬆️</div>
                    <p className="text-sm">點擊上傳圖檔</p>
                    <p className="text-xs">JPG / PNG / PDF，最大 10MB</p>
                  </div>
                )}
                <input id="changeFile" type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button onClick={handleSubmit} disabled={submitting || !form.bank_name || !form.account_number || !file}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
              {submitting ? '送出中...' : '送出帳戶變更申請'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
