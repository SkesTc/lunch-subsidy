'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImpersonateBanner({ schoolName }: { schoolName: string }) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  async function stopImpersonate() {
    setLeaving(true)
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    router.push('/admin')
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium">
      <span>👤 模擬身分中：{schoolName}</span>
      <button onClick={stopImpersonate} disabled={leaving}
        className="bg-white text-amber-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-50 cursor-pointer disabled:opacity-50">
        {leaving ? '返回中...' : '結束模擬 → 返回後台'}
      </button>
    </div>
  )
}
