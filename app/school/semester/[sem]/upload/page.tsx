'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'

function fileViewUrl(path: string) {
  if (!path) return null
  if (!path.includes('/')) return `https://drive.google.com/file/d/${path}/view`
  return `/api/account/file?path=${encodeURIComponent(path)}`
}

export default function UploadPage() {
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) as 1 | 2
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [existingPath, setExistingPath] = useState('')

  // pending states
  const [pendingUpload, setPendingUpload] = useState(false)   // scan_upload 待審核
  const [pendingReupload, setPendingReupload] = useState(false) // scan_reupload 待審核

  // 申請重新上傳 modal
  const [showModal, setShowModal] = useState(false)
  const [modalFile, setModalFile] = useState<File | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requestDone, setRequestDone] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/settlement?semester=${semester}`).then(r => r.json()),
      fetch(`/api/settlement/change-request?semester=${semester}`).then(r => r.json()),
    ]).then(([settle, requests]) => {
      if (settle?.scan_file_path) setExistingPath(settle.scan_file_path)
      if (Array.isArray(requests)) {
        const pending = requests.filter((r: { status: string }) => r.status === 'pending')
        setPendingUpload(pending.some((r: { request_type: string }) => r.request_type === 'scan_upload'))
        setPendingReupload(pending.some((r: { request_type: string }) => r.request_type === 'scan_reupload'))
      }
    }).catch(() => {})
  }, [semester])

  async function handleUpload() {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setError('檔案大小不可超過 20MB'); return }
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', String(semester))
    fd.append('type', 'settlement')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (res.ok) { setDone(true) }
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
              <button onClick={() => router.push('/school')}
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
              <div
                onClick={() => document.getElementById('fileInput')?.click()}
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
                    <p className="text-sm">點擊或拖曳檔案至此</p>
                    <p className="text-xs">PDF / JPG / PNG，最大 20MB</p>
                  </div>
                )}
                <input id="fileInput" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={handleUpload} disabled={!file || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
                {uploading ? '上傳中...' : '確認上傳'}
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
                    {submitting ? '上傳中...' : '送出申請'}
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
