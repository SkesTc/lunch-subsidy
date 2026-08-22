'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Spinner, BlockSpinner } from '@/components/Spinner'
const SchoolYearTab = dynamic(() => import('./SchoolYearTab'), { loading: () => <BlockSpinner /> })
const BackupTab = dynamic(() => import('./BackupTab'), { loading: () => <BlockSpinner /> })

interface Settings {
  system_name: string; host_school: string; school_year: string
  admin_name: string; admin_title: string; admin_phone: string
  plan_name: string; manual_url: string; admin_manual_url: string; drive_folder_id: string
  gas_url: string; gas_secret: string; notify_subject: string; notify_body: string
  review_approve_subject: string; review_approve_body: string
  review_reject_subject: string; review_reject_body: string
  block1_open: string; block1_deadline: string
  block2_open: string; block2_deadline: string
  block3_open: string; block3_deadline: string
  [key: string]: string
}

export default function SettingsTab({ activeSchoolYear }: { activeSchoolYear: string }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [subTab, setSubTab] = useState<'basic' | 'schoolyear' | 'backup'>('basic')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (!data.error) {
        setSettings({
          plan_name: '',
          manual_url: '',
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

  const subTabCls = (t: 'basic' | 'schoolyear' | 'backup') =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${subTab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  const SaveBtn = () => (
    <div className="pt-2 space-y-2">
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <button onClick={handleSave} disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl cursor-pointer transition-colors">
        {saving ? <span className="flex items-center justify-center gap-2"><Spinner /> 儲存中...</span> : saved ? '✅ 已儲存' : '儲存設定'}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 子分頁切換 */}
      <div className="flex gap-2">
        <button className={subTabCls('basic')} onClick={() => setSubTab('basic')}>基本設定</button>
        <button className={subTabCls('schoolyear')} onClick={() => setSubTab('schoolyear')}>學年度管理</button>
        <button className={subTabCls('backup')} onClick={() => setSubTab('backup')}>備份管理</button>
      </div>

      {/* 基本設定 */}
      {subTab === 'basic' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系統名稱</label>
            <input value={settings.system_name} onChange={e => set('system_name', e.target.value)}
              className={inputCls} placeholder="台中市第2區 免費營養午餐核銷系統" />
            <p className="text-xs text-gray-400 mt-1">顯示於導覽列、登入頁及瀏覽器標題</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">承辦學校</label>
            <input value={settings.host_school} onChange={e => set('host_school', e.target.value)}
              className={inputCls} placeholder="例：臺中市神岡區社口國民小學" />
            <p className="text-xs text-gray-400 mt-1">顯示於登入頁；同時作為全區經費收支結算表抬頭</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系統設計姓名</label>
            <input value={settings.admin_name} onChange={e => set('admin_name', e.target.value)}
              className={inputCls} placeholder="林孟甫主任" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系統設計職稱</label>
            <input value={settings.admin_title} onChange={e => set('admin_title', e.target.value)}
              className={inputCls} placeholder="主任" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
            <input value={settings.admin_phone} onChange={e => set('admin_phone', e.target.value)}
              className={inputCls} placeholder="(04)2562-6834 #730" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">學校端使用說明連結</label>
            <input value={settings.manual_url} onChange={e => set('manual_url', e.target.value)}
              className={inputCls} placeholder="https://..." />
            <p className="text-xs text-gray-400 mt-1">學校首頁將顯示此連結供下載使用說明 PDF</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">後台管理者使用說明連結</label>
            <input value={settings.admin_manual_url || ''} onChange={e => set('admin_manual_url', e.target.value)}
              className={inputCls} placeholder="https://..." />
            <p className="text-xs text-gray-400 mt-1">後台右上角將顯示使用說明按鈕</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Drive 上傳資料夾 ID</label>
            <input value={settings.drive_folder_id} onChange={e => set('drive_folder_id', e.target.value)}
              className={inputCls} placeholder="貼上 Google Drive 資料夾 ID" />
            <p className="text-xs text-gray-400 mt-1">從資料夾網址取得：drive.google.com/drive/folders/<span className="font-mono text-gray-600">此處為ID</span></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GAS 網址</label>
            <input value={settings.gas_url} onChange={e => set('gas_url', e.target.value)}
              className={inputCls} placeholder="https://script.google.com/macros/s/...../exec" />
            <p className="text-xs text-gray-400 mt-1">Google Apps Script 部署網址（上傳檔案、刪除檔案、寄信共用）</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GAS 驗證金鑰</label>
            <input value={settings.gas_secret} onChange={e => set('gas_secret', e.target.value)}
              className={inputCls} placeholder="自訂一組密碼（須與 GAS 腳本一致）" />
          </div>
          <SaveBtn />
        </div>
      )}

      {/* 學年度管理 */}
      {subTab === 'schoolyear' && <SchoolYearTab />}

      {/* 備份管理 */}
      {subTab === 'backup' && <BackupTab />}
    </div>
  )
}

function StatCard({ label, value, total, warn, isAmount }: {
  label: string; value: number | string; total?: number; warn?: string; isAmount?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-1">
        {isAmount ? value : `${value}${total !== undefined ? ` / ${total}` : ''}`}
      </p>
      {warn && <p className="text-xs text-orange-500 mt-1">{warn}</p>}
    </div>
  )
}
