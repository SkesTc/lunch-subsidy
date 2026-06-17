'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatAmount } from '@/lib/utils'

export default function RemittancePage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [date, setDate] = useState('')
  const [repayAmount, setRepayAmount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settlement?semester=2').then(r => r.json()).then(d => {
      if (d) setRepayAmount(d.repay_amount || 0)
    })
  }, [])

  async function handleUpload() {
    if (!file || !date) { setError('請選擇檔案並填寫繳款日期'); return }
    if (file.size > 10 * 1024 * 1024) { setError('檔案大小不可超過 10MB'); return }
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', '2')
    fd.append('type', 'remittance')
    fd.append('remittance_date', date)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) { setDone(true) } else { setError('上傳失敗，請再試一次') }
    setUploading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/school" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">第2學期・上傳送款憑單</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">上傳賸餘款送款憑單</h1>
            <p className="text-sm text-gray-500 mt-1">第2學期・賸餘款繳回公庫</p>
          </div>

          {repayAmount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm">
              <p className="font-semibold text-orange-700">應繳回金額</p>
              <p className="text-2xl font-bold text-red-600 mt-1">NT$ {formatAmount(repayAmount)}</p>
              <p className="text-orange-600 text-xs mt-2">請至銀行辦理繳款，取得公庫送款憑單後掃描上傳</p>
            </div>
          )}

          {done ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-semibold text-green-700">送款憑單上傳成功！</p>
              <button onClick={() => router.push('/school')}
                className="mt-2 bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 cursor-pointer">
                返回首頁
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">繳款日期 <span className="text-red-500">*</span></label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div
                onClick={() => document.getElementById('remitFile')?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-8 text-center cursor-pointer transition-colors"
              >
                {file ? (
                  <div className="space-y-1">
                    <div className="text-2xl">📄</div>
                    <p className="font-medium text-gray-700">{file.name}</p>
                    <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div className="space-y-2 text-gray-400">
                    <div className="text-3xl">⬆️</div>
                    <p className="text-sm">點擊上傳送款憑單掃描檔</p>
                    <p className="text-xs">PDF / JPG / PNG，最大 10MB</p>
                  </div>
                )}
                <input id="remitFile" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button onClick={handleUpload} disabled={!file || !date || uploading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
                {uploading ? '上傳中...' : '確認上傳送款憑單'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
