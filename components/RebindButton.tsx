'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RebindButton() {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRebind() {
    setLoading(true)
    await fetch('/api/account/unbind', { method: 'POST' })
    router.push('/bind-school')
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-2 py-1 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 cursor-pointer"
        >
          取消
        </button>
        <button
          onClick={handleRebind}
          disabled={loading}
          className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer disabled:opacity-50"
        >
          {loading ? '處理中...' : '確認重新綁定'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 cursor-pointer"
    >
      重新綁定Gmail
    </button>
  )
}
