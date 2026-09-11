'use client'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Spinner } from '@/components/Spinner'

function fileViewUrl(path: string) {
  if (!path) return null
  if (!path.includes('/')) return `https://drive.google.com/file/d/${path}/view`
  return `/api/account/file?path=${encodeURIComponent(path)}`
}

export default function UploadPage() {
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) as 1 | 2
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan_id') || null
  const router = useRouter()
  const [statusLoading, setStatusLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [existingPath, setExistingPath] = useState('')

  // pending states
  const [pendingUpload, setPendingUpload] = useState(false)   // scan_upload 待審核
  const [pendingReupload, setPendingReupload] = useState(false) // scan_reupload 待審核
  const [amountFilled, setAmountFilled] = useState(false) // 實支金額是否已填

  // 申請重新上傳 modal
  const [showModal, setShowModal] = useState(false)
  const [modalFile, setModalFile] = useState<File | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requestDone, setRequestDone] = useState(false)

  useEffect(() => {
    const statusUrl = planId ? `/api/school/status?semester=${semester}&plan_id=${planId}` : `/api/school/status?semester=${semester}`
    fetch(statusUrl).then(r => r.json()).then(({ settlement, pendingRequests }) => {
      if (settlement?.scan_file_path) setExistingPath(settlement.scan_file_path)
      // 實支金額已填（大於 0）才允許上傳
      if (settlement?.business_expense != null && Number(settlement.business_expense) > 0) setAmountFilled(true)
      if (Array.isArray(pendingRequests)) {
        const pending = pendingRequests.filter((r: { status: string }) => r.status === 'pending')
        setPendingUpload(pending.some((r: { request_type: string }) => r.request_type === 'scan_upload'))
        setPendingReupload(pending.some((r: { request_type: string }) => r.request_type === 'scan_reupload'))
      }
    }).catch(() => {}).finally(() => setStatusLoading(false))
  }, [semester, planId])

  async function handleUpload() {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setError('檔案大小不可超過 20MB'); return }
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', String(semester))
    fd.append('type', 'settlement')
    if (planId) fd.append('plan_id', planId)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) { setDone(true); setPendingUpload(true) }
    else { const d = await res.json().catch(() => ({})); setError(d.error || '上傳失敗，請再試一次') }
    setUploading(false)
  }

  async function handleRequestSubmit() {
    if (!modalFile) { setReasonError('請選擇要上傳的新檔案'); return }
    if (!reason.trim()) { setReasonError('請填寫申請原因'); return }
    if (modalFile.size > 20 * 1024 * 1024) { setReasonError('檔案大小不可超過 20MB'); return }
    setSubmitting(true); setReasonError('')
    const fd = new FormData()
    fd.append('file', modalFile)
    fd.append('semester', String(semester))
    fd.append('type', 'settlement')
    fd.append('reason', reason)
    if (planId) fd.append('plan_id', planId)
    const res = await fetch('/api/upload/reupload-request', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) { setRequestDone(true); setPendingReupload(true) }
    else { setReasonError(data.error || '送出失敗') }
    setSubmitting(false)
  }

  function closeModal() {
    setShowModal(false); setModalFile(null); setReason(''); setReasonError(''); setRequestDone(false)
  }

  const viewUrl = existingPath ? fileViewUrl(existingPath) : null

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
          <span className="text-sm text-gray-600">第{semester}學期・上傳結算表掃描檔</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">上傳經費收支結算表掃描檔</h1>
            <p className="text-sm text-gray-500 mt-1">請上傳列印逐級核章後的掃描檔（PDF / JPG / PNG）</p>
          </div>

          {/* 上傳成功，等待審核 */}
          {done ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
              <div className="text-4xl">📨</div>
              <p className="font-semibold text-amber-700">檔案已上傳，待審核中</p>
              <p className="text-sm text-amber-600">承辦學校審核通過後即生效，請靜候通知</p>
              <button onClick={() => { router.refresh(); router.push('/school') }}
                className="mt-2 bg-amber-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-amber-700 cursor-pointer">
                返回首頁
              </button>
            </div>

          /* 首次上傳待審核中 */
          ) : pendingUpload ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-2">
              <div className="text-3xl">⏳</div>
              <p className="font-semibold text-amber-700">掃描檔待審核中</p>
              <p className="text-sm text-amber-600">已送出上傳申請，承辦學校審核通過後即生效</p>
            </div>

          /* 已有核准檔案 */
          ) : existingPath ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ 已核准</span>
                  <p className="text-sm font-medium text-blue-700">此學期已上傳掃描檔</p>
                </div>
                {viewUrl && (
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline">
                    📄 開啟已上傳的檔案
                  </a>
                )}
              </div>
              {pendingReupload ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 text-center">
                  ⏳ 重新上傳申請待審核中，請靜候通知
                </div>
              ) : (
                <button onClick={() => setShowModal(true)}
                  className="w-full border border-amber-400 text-amber-700 hover:bg-amber-50 font-medium py-2.5 rounded-xl transition-colors cursor-pointer text-sm">
                  申請重新上傳
                </button>
              )}
            </div>

          /* 未上傳，顯示上傳表單 */
          ) : (
            <>
              {/* 實支金額未填警示 */}
              {!amountFilled && (
                <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 flex gap-3 items-start">
                  <span className="text-xl mt-0.5">⚠️</span>
                  <div>
                    <p className="font-semibold text-orange-700 text-sm">請先填寫實支金額</p>
                    <p className="text-xs text-orange-600 mt-0.5">上傳掃描檔前，須先至「經費結算」頁面填寫並儲存實支金額，確保掃描檔與金額一致。</p>
                    <Link href={planId ? `/school/semester/${semester}/settlement?plan_id=${planId}` : `/school/semester/${semester}/settlement`}
                      className="inline-block mt-2 text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700">
                      前往填寫實支金額 →
                    </Link>
                  </div>
                </div>
              )}
              <div
                onClick={() => amountFilled && document.getElementById('fileInput')?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${amountFilled ? 'border-gray-300 hover:border-blue-400 cursor-pointer' : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'}`}
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
                    <p className="text-sm">點擊或拖曳檔案至此</p>
                    <p className="text-xs">PDF / JPG / PNG，最大 20MB</p>
                  </div>
                )}
                <input id="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={!amountFilled}
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={handleUpload} disabled={!file || uploading || !amountFilled}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
                {uploading ? <span className="flex items-center justify-center gap-2"><Spinner /> 上傳中...</span> : '確認上傳'}
              </button>
              {/* 上傳前置步驟提示 */}
              {(!amountFilled || !file) && !uploading && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">上傳前須完成以下步驟</p>
                  <ol className="space-y-1.5">
                    <li className={`flex items-center gap-2 text-sm ${amountFilled ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${amountFilled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                        {amountFilled ? '✓' : '1'}
                      </span>
                      {amountFilled ? <span>已填寫實支金額</span> : <span>至「經費結算」填寫並儲存實支金額</span>}
                    </li>
                    <li className={`flex items-center gap-2 text-sm ${file ? 'text-green-600' : 'text-gray-500'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${file ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                        {file ? '✓' : '2'}
                      </span>
                      {file ? <span>已選擇掃描檔：{file.name}</span> : <span>選擇已列印逐級核章的掃描檔</span>}
                    </li>
                  </ol>
                </div>
              )}
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
                <p className="text-sm text-gray-500">承辦學校審核通過後，新的檔案將自動替換現有檔案。</p>
                <button onClick={closeModal}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-700">確定</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">申請重新上傳掃描檔</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
                </div>
                <div
                  onClick={() => document.getElementById('modalFileInput')?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-5 text-center cursor-pointer transition-colors"
                >
                  {modalFile ? (
                    <div className="space-y-1"><div className="text-xl">📄</div>
                      <p className="text-sm font-medium text-gray-700">{modalFile.name}</p>
                      <p className="text-xs text-gray-400">{(modalFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  ) : (
                    <div className="space-y-1 text-gray-400"><div className="text-2xl">⬆️</div>
                      <p className="text-sm">點擊選擇新的掃描檔</p>
                    </div>
                  )}
                  <input id="modalFileInput" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => setModalFile(e.target.files?.[0] || null)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">申請原因 <span className="text-red-500">*</span></label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="例如：掃描品質不佳、蓋章位置有誤..." />
                </div>
                {reasonError && <p className="text-sm text-red-600">{reasonError}</p>}
                <div className="flex gap-3">
                  <button onClick={closeModal} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm cursor-pointer hover:bg-gray-50">取消</button>
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
