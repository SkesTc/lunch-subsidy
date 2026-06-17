'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function UploadPage() {
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) as 1 | 2
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload() {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('檔案大小不可超過 10MB'); return }
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('semester', String(semester))
    fd.append('type', 'settlement')
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
          <span className="text-sm text-gray-600">第{semester}學期・上傳結算表掃描檔</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">上傳收支結算表掃描檔</h1>
            <p className="text-sm text-gray-500 mt-1">請上傳列印蓋章後的掃描檔（PDF / JPG / PNG）</p>
          </div>

          {done ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-semibold text-green-700">上傳成功！</p>
              <p className="text-sm text-green-600">承辦學校將下載確認，若有問題會與您聯繫</p>
              <button onClick={() => router.push('/school')}
                className="mt-2 bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 cursor-pointer">
                返回首頁
              </button>
            </div>
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
                    <p className="text-xs">PDF / JPG / PNG，最大 10MB</p>
                  </div>
                )}
                <input
                  id="fileInput"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {uploading ? '上傳中...' : '確認上傳'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
