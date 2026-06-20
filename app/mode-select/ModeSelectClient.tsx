'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ModeSelectClient({
  hasSchool, email
}: { hasSchool: boolean; email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'admin' | 'school' | null>(null)

  function go(mode: 'admin' | 'school') {
    setLoading(mode)
    router.push(mode === 'admin' ? '/admin' : '/school')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm space-y-6 text-center">
        <div>
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-xl font-bold text-gray-800">請選擇登入模式</h1>
          <p className="text-sm text-gray-400 mt-1 truncate">{email}</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => go('admin')}
            disabled={!!loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-medium py-3.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'admin' ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />進入中...</>
            ) : '⚙️ 系統管理模式'}
          </button>

          {hasSchool && (
            <button
              onClick={() => go('school')}
              disabled={!!loading}
              className="w-full border-2 border-blue-200 hover:bg-blue-50 disabled:opacity-70 text-blue-700 font-medium py-3.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              {loading === 'school' ? (
                <><div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />進入中...</>
              ) : '🏫 學校核銷模式'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
