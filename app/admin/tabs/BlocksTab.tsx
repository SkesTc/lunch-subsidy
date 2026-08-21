'use client'
import { useState, useEffect } from 'react'
import { BlockSpinner, Spinner } from '@/components/Spinner'

interface Settings {
  block1_open: string; block1_deadline: string
  block2_open: string; block2_deadline: string
  block3_open: string; block3_deadline: string
  [key: string]: string
}

const BLOCKS: { label: string; openKey: string; deadlineKey: string }[] = [
  { label: '第1學期初（帳戶確認）', openKey: 'block1_open', deadlineKey: 'block1_deadline' },
  { label: '第1學期末（第1學期核銷）', openKey: 'block2_open', deadlineKey: 'block2_deadline' },
  { label: '第2學期末（第2學期核銷）', openKey: 'block3_open', deadlineKey: 'block3_deadline' },
]

export default function BlocksTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (!data.error) setSettings(data)
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true); setSaveError('')
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const d = await res.json()
      setSaveError(d.error || '儲存失敗')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  function set(k: string, v: string) {
    setSettings(prev => prev ? { ...prev, [k]: v } : prev)
  }

  if (loading) return <BlockSpinner />
  if (!settings) return <div className="text-center py-8 text-red-400">讀取設定失敗，請重新整理</div>

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="font-semibold text-gray-800">核銷期程設定</h2>
        <p className="text-sm text-gray-500 mt-1">各階段可單獨開放或關閉，關閉後學校畫面顯示「此階段尚未開放」。</p>
      </div>
      {BLOCKS.map(({ label, openKey, deadlineKey }) => (
        <div key={openKey} className="border border-gray-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">開放</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings[openKey] === 'true'}
                onChange={e => set(openKey, e.target.checked ? 'true' : 'false')}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
            <span className={`text-sm font-medium ${settings[openKey] === 'true' ? 'text-green-600' : 'text-gray-400'}`}>
              {settings[openKey] === 'true' ? '開放中' : '已關閉'}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">期限說明文字（顯示在學校畫面）</label>
            <input value={settings[deadlineKey] || ''} onChange={e => set(deadlineKey, e.target.value)}
              className={inputCls} placeholder="例：2026-02-15 或 學期末截止" />
          </div>
        </div>
      ))}
      <div className="pt-2 space-y-2">
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl cursor-pointer transition-colors">
          {saving ? <span className="flex items-center gap-2"><Spinner /> 儲存中...</span> : saved ? '✅ 已儲存' : '儲存設定'}
        </button>
      </div>
    </div>
  )
}
