'use client'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatAmount } from '@/lib/utils'
import { Spinner } from '@/components/Spinner'

export default function RemittancePage() {
  const router = useRouter()
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) || 2
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan_id') || null
  const [statusLoading, setStatusLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [date, setDate] = useState('')
  const [repayAmount, setRepayAmount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [existingPath, setExistingPath] = useState('')
  const [existingDate, setExistingDate] = useState('')

  // 申請重新上傳 modal
  const [showModal, setShowModal] = useState(false)
  const [modalFile, setModalFile] = useState<File | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requestDone, setRequestDone] = useState(false)
  const [hasPendingRequest, setHasPendingRequest] = useState(false)
  const [pendingUpload, setPendingUpload] = useState(false)

  function fileViewUrl(path: string) {
    if (!path) return null
    if (!path.includes('/')) return `https://drive.google.com/file/d/${path}/view`
    return `/api/account/file?path=${encodeURIComponent(path)}`
  }

  useEffect(() => {
    const statusUrl = planId ? `/api/school/status?semester=${semester}&plan_id=${planId}` : `/api/school/status?semester=${semester}`
    fetch(statusUrl).then(r => r.json()).then(({ settlement, pendingRequests }) => {
      if (settlement) {
        setRepayAmount(settlement.repay_amount || 0)
        if (settlement.remittance_file_path) setExistingPath(settlement.remittance_file_path)
        if (settlement.remittance_date) setExistingDate(settlement.remittance_date)
      }
      if (Array.isArray(pendingRequests)) {
        const pending = pendingRequests.filter((r: { status: string }) => r.status === 'pending')
        setPendingUpload(pending.some((r: { request_type: string }) => r.request_type === 'remittance_upload'))
        setHasPendingRequest(pending.some((r: { request_type: string }) => r.request_type === 'remittance_reupload'))
      }
    }).catch(() => {}).finally(() => setStatusLoading(false))
  }, [])

  async function handleUpload() {
    if (!file || !date) { setError('請選擇檔案並填寫繳款日期'); return }
    if (file.size > 20 * 1024 * 1024) { setError('檔案大小不可超過 20MB'); return }
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', String(semester))
    fd.append('type', 'remittance')
    fd.append('remittance_date', date)
    if (planId) fd.append('plan_id', planId)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) { setDone(true); setPendingUpload(true) } else { const d = await res.json().catch(() => ({})); setError(d.error || '上傳失敗，請再試一次') }
    setUploading(false)
  }

  async function handleRequestSubmit() {
    if (!modalFile) { setReasonError('請選擇要上傳的新憑單'); return }
    if (!reason.trim()) { setReasonError('請填寫申請原因'); return }
    if (modalFile.size > 20 * 1024 * 1024) { setReasonError('檔案大小不可超過 20MB'); return }
    setSubmitting(true); setReasonError('')
    const fd = new FormData()
    fd.append('file', modalFile)
    fd.append('semester', String(semester))
    fd.append('type', 'remittance')
    fd.append('reason', reason)
    if (planId) fd.append('plan_id', planId)
    const res = await fetch('/api/upload/reupload-request', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setRequestDone(true)
      setHasPendingRequest(true)
    } else {
      setReasonError(data.error || '送出失敗')
    }
    setSubmitting(false)
  }

  function closeModal() {
    setShowModal(false)
    setModalFile(null)
    setReason('')
    setReasonError('')
    setRequestDone(false)
  }

  const isLocked = !!existingPath && !pendingUpload

  if (statusLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

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
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
              <div className="text-4xl">📨</div>
              <p className="font-semibold text-amber-700">憑單已上傳，待審核中</p>
              <p className="text-sm text-amber-600">承辦學校審核通過後即生效，請靜候通知</p>
              <button onClick={() => { router.refresh(); router.push('/school') }}
                className="mt-2 bg-amber-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-amber-700 cursor-pointer">
                返回首頁
              </button>
            </div>
          ) : pendingUpload ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-2">
              <div className="text-3xl">⏳</div>
              <p className="font-semibold text-amber-700">送款憑單待審核中</p>
              <p className="text-sm text-amber-600">已送出上傳申請，承辦學校審核通過後即生效</p>
            </div>
          ) : isLocked ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ 已核准</span>
                  <p className="text-sm font-medium text-blue-700">已上傳送款憑單</p>
                </div>
                {existingDate && <p className="text-xs text-blue-500">繳款日期：{existingDate}</p>}
                {fileViewUrl(existingPath) && (
                  <a href={fileViewUrl(existingPath)!} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline">
                    📄 開啟已上傳的憑單
                  </a>
                )}
              </div>
              {hasPendingRequest ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                  📨 重新上傳申請已送出，請等待承辦學校審核後生效。
                </div>
              ) : (
                <button onClick={() => setShowModal(true)}
                  className="w-full border border-amber-400 text-amber-700 hover:bg-amber-50 font-medium py-2.5 rounded-xl transition-colors cursor-pointer text-sm">
                  申請重新上傳
                </button>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">繳款日期 <span className="text-red-500">*</span></label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div onClick={() => document.getElementById('remitFile')?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-8 text-center cursor-pointer transition-colors">
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
                {uploading ? <span className="flex items-center justify-center gap-2"><Spinner /> 上傳中...</span> : '確認上傳送款憑單'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 申請重新上傳 Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            {requestDone ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl">📨</div>
                <p className="font-semibold text-gray-800">申請已送出</p>
                <p className="text-sm text-gray-500">承辦學校審核通過後，新的憑單將自動替換現有憑單。</p>
                <button onClick={closeModal}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-700">
                  確定
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">申請重新上傳憑單</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
                </div>
                <p className="text-sm text-gray-500">請選擇新的憑單並說明原因，送出後由承辦學校審核，通過後自動替換。</p>

                <div
                  onClick={() => document.getElementById('modalRemitFile')?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer transition-colors"
                >
                  {modalFile ? (
                    <div className="space-y-1">
                      <div className="text-xl">📄</div>
                      <p className="text-sm font-medium text-gray-700">{modalFile.name}</p>
                      <p className="text-xs text-gray-400">{(modalFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-gray-400">
                      <div className="text-2xl">⬆️</div>
                      <p className="text-sm">點擊選擇新的憑單</p>
                      <p className="text-xs">PDF / JPG / PNG，最大 10MB</p>
                    </div>
                  )}
                  <input id="modalRemitFile" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => setModalFile(e.target.files?.[0] || null)} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申請原因 <span className="text-red-500">*</span></label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="例如：憑單金額有誤、上傳錯誤檔案..." />
                </div>

                {reasonError && <p className="text-sm text-red-600">{reasonError}</p>}

                <div className="flex gap-3">
                  <button onClick={closeModal}
                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm cursor-pointer hover:bg-gray-50">
                    取消
                  </button>
                  <button onClick={handleRequestSubmit} disabled={submitting}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-700 disabled:bg-gray-300">
                    {submitting ? <span className="flex items-center justify-center gap-2"><Spinner /> 上傳中...</span> : '送出申請'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
