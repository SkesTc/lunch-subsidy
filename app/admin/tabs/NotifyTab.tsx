'use client'
import { useState, useEffect } from 'react'
import { Spinner, BlockSpinner } from '@/components/Spinner'

interface Settings {
  notify_subject: string; notify_body: string
  review_approve_subject: string; review_approve_body: string
  review_reject_subject: string; review_reject_body: string
  [key: string]: string
}

export default function NotifyTab({ isSuperAdmin }: { isSuperAdmin?: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (!data.error) {
        setSettings({
          notify_subject: '',
          notify_body: '',
          review_approve_subject: '',
          review_approve_body: '',
          review_reject_subject: '',
          review_reject_body: '',
          ...data,
        })
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    setSaveError('')
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

  function set(k: keyof Settings, v: string) {
    setSettings(prev => prev ? { ...prev, [k]: v } : prev)
  }

  if (loading) return <BlockSpinner />
  if (!settings) return <div className="text-center py-8 text-red-400">讀取設定失敗，請重新整理</div>

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-6">

      {/* 共用變數說明 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">可用變數說明</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {[
            ['{schoolName}', '學校名稱'],
            ['{contactName}', '學校承辦人姓名'],
            ['{contactTitle}', '學校承辦人職稱'],
            ['{zoneName}', '區別名稱（例：臺中市第2區）'],
            ['{hostSchool}', '承辦學校名稱（取自各分區設定）'],
            ['{adminName}', '承辦人姓名（取自各分區設定）'],
            ['{adminTitle}', '承辦人職稱（取自各分區設定）'],
            ['{adminPhone}', '承辦人電話（取自各分區設定）'],
            ['{semLabel}', '學期（含計畫名，例：免費午餐・第1學期）'],
            ['{planLabel}', '計畫名稱（例：免費午餐）'],
            ['{typeLabel}', '申請類型'],
            ['{actionNote}', '核准後操作說明（自動）'],
            ['{adminNote}', '備註說明'],
          ].map(([v, desc]) => (
            <div key={v} className="flex items-baseline gap-2">
              <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-xs flex-shrink-0">{v}</span>
              <span className="text-gray-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 催收通知 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 border-b pb-2">催收通知</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
          <input value={settings.notify_subject} onChange={e => set('notify_subject', e.target.value)}
            className={inputCls} placeholder="【核銷系統】請儘速完成資料上傳" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
          <textarea value={settings.notify_body} onChange={e => set('notify_body', e.target.value)}
            rows={6} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* 審核通過通知 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 border-b pb-2">✅ 審核通過通知</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
          <input value={settings.review_approve_subject} onChange={e => set('review_approve_subject', e.target.value)}
            className={inputCls} placeholder="【核銷系統】{semLabel}申請已核准" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
          <textarea value={settings.review_approve_body} onChange={e => set('review_approve_body', e.target.value)}
            rows={6} className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* 審核拒絕通知 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 border-b pb-2">❌ 審核拒絕通知</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
          <input value={settings.review_reject_subject} onChange={e => set('review_reject_subject', e.target.value)}
            className={inputCls} placeholder="【核銷系統】{semLabel}申請未通過" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
          <textarea value={settings.review_reject_body} onChange={e => set('review_reject_body', e.target.value)}
            rows={6} className={`${inputCls} resize-none`} />
        </div>
      </div>

      <div className="pt-2 space-y-2">
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {isSuperAdmin === false ? (
          <p className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            🔒 通知信範本僅限超級管理員修改
          </p>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl cursor-pointer transition-colors">
            {saving ? <span className="flex items-center justify-center gap-2"><Spinner /> 儲存中...</span> : saved ? '✅ 已儲存' : '儲存設定'}
          </button>
        )}
      </div>
    </div>
  )
}
