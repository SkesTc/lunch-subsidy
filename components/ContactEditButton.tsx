'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ContactEditButton({
  initialName, initialTitle, initialPhone
}: { initialName: string; initialTitle: string; initialPhone: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [title, setTitle] = useState(initialTitle)
  const [phone, setPhone] = useState(initialPhone)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch('/api/account/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactName: name, contactTitle: title, contactPhone: phone }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-800">編輯聯絡資訊</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">承辦人姓名</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="請輸入姓名"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">職稱</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例：組長、主任、幹事"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="例：04-12345678 #123"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setOpen(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 cursor-pointer">
              取消
            </button>
            <button onClick={handleSave} disabled={saving || !name || !phone}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm cursor-pointer disabled:cursor-not-allowed">
              {saving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setOpen(true)}
      className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 cursor-pointer">
      編輯聯絡資訊
    </button>
  )
}
