'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface School { id: number; code: number; name: string; district: string }

export default function ModeSelectClient({
  hasSchool, email
}: { hasSchool: boolean; email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'admin' | 'school' | 'impersonate' | null>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [search, setSearch] = useState('')
  const [showSchoolPicker, setShowSchoolPicker] = useState(false)

  useEffect(() => {
    fetch('/api/admin/schools-manage')
      .then(r => r.json())
      .then(d => setSchools(Array.isArray(d) ? d.filter((s: School & { is_active: boolean }) => s.is_active) : []))
      .catch(() => {})
  }, [])

  function goAdmin() {
    setLoading('admin')
    router.push('/admin')
  }

  function goOwnSchool() {
    setLoading('school')
    router.push('/school')
  }

  async function goSchool(school: School) {
    setLoading('impersonate')
    await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: school.id, school_name: school.name }),
    })
    router.push('/school')
  }

  const filtered = schools.filter(s =>
    !search || s.name.includes(search) || String(s.code).includes(search) || s.district.includes(search)
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="text-4xl mb-3">👋</div>
          <h1 className="text-xl font-bold text-gray-800">請選擇登入模式</h1>
          <p className="text-sm text-gray-400 mt-1 truncate">{email}</p>
        </div>

        <div className="space-y-3">
          {/* 系統管理模式 */}
          <button onClick={goAdmin} disabled={!!loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-medium py-3.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2">
            {loading === 'admin'
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />進入中...</>
              : '⚙️ 系統管理模式'}
          </button>

          {/* 學校核銷模式（自己的學校） */}
          {hasSchool && (
            <button onClick={goOwnSchool} disabled={!!loading}
              className="w-full border-2 border-blue-200 hover:bg-blue-50 disabled:opacity-70 text-blue-700 font-medium py-3.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2">
              {loading === 'school'
                ? <><div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />進入中...</>
                : '🏫 學校核銷模式（我的學校）'}
            </button>
          )}

          {/* 選擇學校進入核銷模式 */}
          {schools.length > 0 && (
            <div>
              <button onClick={() => setShowSchoolPicker(v => !v)} disabled={!!loading}
                className="w-full border-2 border-gray-200 hover:bg-gray-50 disabled:opacity-70 text-gray-600 font-medium py-3 rounded-xl cursor-pointer transition-colors text-sm flex items-center justify-center gap-2">
                🔍 {showSchoolPicker ? '收起學校列表' : '選擇學校進入核銷模式'}
              </button>

              {showSchoolPicker && (
                <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="搜尋學校名稱、編號或行政區..."
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 py-4">無符合學校</p>
                    ) : filtered.map(s => (
                      <button key={s.id} onClick={() => goSchool(s)} disabled={!!loading}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer">
                        <span className="text-sm font-medium text-gray-800">{s.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{s.district} · #{s.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {loading === 'impersonate' && (
          <p className="text-center text-xs text-gray-400">進入學校模式中...</p>
        )}
      </div>
    </div>
  )
}
