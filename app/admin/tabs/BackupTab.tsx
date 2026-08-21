'use client'
import { useState, useEffect } from 'react'
import { Spinner, BlockSpinner } from '@/components/Spinner'

interface BackupFile {
  fileId: string
  name: string
  type: 'manual' | 'scheduled' | 'school_year'
  size: number
  createdTime: string
}

interface BackupSettings {
  backup_folder_id: string
  backup_enabled: string
  backup_frequency: string   // daily | weekly | monthly
  backup_hour: string
  backup_weekday: string     // 1=週一 ... 7=週日 (weekly 用)
  backup_retain_daily: string
  backup_retain_manual: string
  backup_notify_email: string
  backup_trigger_secret: string
  backup_scheduled_url: string
}

const SCOPE_LABELS: Record<string, string> = {
  schools: '學校清單',
  plans: '核銷計畫',
  plan_amounts: '計畫核定金額',
  school_amounts: '學期核定金額',
  settlements: '結算記錄',
  bank_accounts: '學校帳戶',
  change_requests: '申請審核記錄',
  user_profiles: '帳號與聯絡人',
  settings: '系統設定',
}

const TYPE_LABELS: Record<string, string> = {
  manual: '✋ 手動', scheduled: '🤖 定時', school_year: '📅 學年',
}

export default function BackupTab() {
  const [settings, setSettings] = useState<BackupSettings>({
    backup_folder_id: '', backup_enabled: 'false',
    backup_frequency: 'daily', backup_hour: '2', backup_weekday: '1',
    backup_retain_daily: '30', backup_retain_manual: '10',
    backup_notify_email: '', backup_trigger_secret: '', backup_scheduled_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingMsg, setSettingMsg] = useState('')
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [backing, setBacking] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [restoreModal, setRestoreModal] = useState<BackupFile | null>(null)
  const [restoreScopes, setRestoreScopes] = useState<string[]>(Object.keys(SCOPE_LABELS))
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<{ ok: boolean; results: Record<string,number>; errors: string[] } | null>(null)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setSettings(prev => ({ ...prev, ...Object.fromEntries(Object.keys(prev).map(k => [k, d[k] || prev[k as keyof BackupSettings]])) }))
      setLoading(false)
    })
    loadBackups()
  }, [])

  async function loadBackups() {
    setLoadingList(true)
    const res = await fetch('/api/admin/backup')
    const data = await res.json()
    setBackups(Array.isArray(data) ? data : [])
    setLoadingList(false)
  }

  async function saveSettings() {
    setSavingSettings(true); setSettingMsg('')
    const enabled = settings.backup_enabled === 'true'
    const weekdayNames: Record<string, string> = { '1':'週日','2':'週一','3':'週二','4':'週三','5':'週四','6':'週五','7':'週六' }
    const freqLabel = settings.backup_frequency === 'weekly'
      ? `每週${weekdayNames[settings.backup_weekday] || ''}`
      : settings.backup_frequency === 'monthly' ? '每月1日' : '每日'
    const res = await fetch('/api/admin/backup/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, hour: Number(settings.backup_hour), frequency: settings.backup_frequency, weekday: Number(settings.backup_weekday), settings }),
    })
    const d = await res.json()
    if (d.ok) {
      if (!enabled) {
        setSettingMsg('✅ 備份設定已儲存，定時備份已關閉')
      } else if (d.gas === false) {
        setSettingMsg(`✅ 設定已儲存，但 GAS 觸發器建立失敗：${d.message || '請確認 GAS 腳本已更新並重新部署'}`)
      } else {
        setSettingMsg(`✅ 備份設定已儲存，GAS 觸發器建立成功，${freqLabel} ${settings.backup_hour}:00 執行`)
      }
    } else {
      setSettingMsg(`❌ ${d.error || '儲存失敗'}`)
    }
    setSavingSettings(false)
  }

  async function runBackup() {
    setBacking(true); setBackupMsg('')
    const res = await fetch('/api/admin/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'manual' }),
    })
    const d = await res.json()
    if (d.ok) {
      setBackupMsg(`✅ 備份完成：${d.filename}`)
      loadBackups()
    } else {
      setBackupMsg(`❌ ${d.error || '備份失敗'}`)
    }
    setBacking(false)
  }

  async function deleteBackup(fileId: string) {
    if (!confirm('確定要刪除此備份？')) return
    await fetch('/api/admin/backup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    })
    loadBackups()
  }

  async function doRestore() {
    if (confirmText !== '確認還原') return
    setRestoring(true); setRestoreResult(null)
    const res = await fetch('/api/admin/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId: restoreModal!.fileId, scopes: restoreScopes }),
    })
    const d = await res.json()
    setRestoreResult(d)
    setRestoring(false)
    if (d.ok) loadBackups()
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"

  if (loading) return <BlockSpinner />

  return (
    <div className="space-y-6 max-w-2xl">

      {/* 備份設定 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">備份設定</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備份儲存資料夾 ID（Google Drive）</label>
          <input value={settings.backup_folder_id} onChange={e => setSettings(s => ({ ...s, backup_folder_id: e.target.value }))}
            className={inputCls} placeholder="Google Drive 備份資料夾 ID" />
          <p className="text-xs text-gray-400 mt-1">備份 JSON 將上傳至此資料夾</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">定時備份通知信收件人</label>
          <input value={settings.backup_notify_email} onChange={e => setSettings(s => ({ ...s, backup_notify_email: e.target.value }))}
            className={inputCls} placeholder="admin@xxx.edu.tw" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">每日備份保留天數</label>
            <input type="number" value={settings.backup_retain_daily} onChange={e => setSettings(s => ({ ...s, backup_retain_daily: e.target.value }))}
              className={inputCls} min={7} max={365} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">手動備份保留筆數</label>
            <input type="number" value={settings.backup_retain_manual} onChange={e => setSettings(s => ({ ...s, backup_retain_manual: e.target.value }))}
              className={inputCls} min={3} max={50} />
          </div>
        </div>

        <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">定時備份</p>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={settings.backup_enabled === 'true'}
                onChange={e => setSettings(s => ({ ...s, backup_enabled: e.target.checked ? 'true' : 'false' }))}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
            </label>
          </div>
          {settings.backup_enabled === 'true' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-2">備份頻率</label>
                <div className="flex gap-2">
                  {[{ v: 'daily', label: '每日' }, { v: 'weekly', label: '每週' }, { v: 'monthly', label: '每月1日' }].map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => setSettings(s => ({ ...s, backup_frequency: v }))}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer border transition-colors ${settings.backup_frequency === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {settings.backup_frequency === 'weekly' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">每週幾執行</label>
                  <select value={settings.backup_weekday} onChange={e => setSettings(s => ({ ...s, backup_weekday: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {[['2','週一'],['3','週二'],['4','週三'],['5','週四'],['6','週五'],['7','週六'],['1','週日']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">執行時間（小時，0-23）</label>
                <input type="number" value={settings.backup_hour} min={0} max={23}
                  onChange={e => setSettings(s => ({ ...s, backup_hour: e.target.value }))}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-xs text-gray-400 ml-2">時（例：2 = 凌晨 2:00）</span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">本系統網址（GAS 定時觸發用）</label>
                <input value={settings.backup_scheduled_url} onChange={e => setSettings(s => ({ ...s, backup_scheduled_url: e.target.value }))}
                  className={inputCls} placeholder="https://lunch.skes.tc.edu.tw" />
              </div>
            </>
          )}
        </div>

        {settingMsg && <p className={`text-sm font-medium ${settingMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{settingMsg}</p>}
        <button onClick={saveSettings} disabled={savingSettings}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm cursor-pointer">
          {savingSettings ? <span className="flex items-center gap-2"><Spinner />儲存中...</span> : '儲存設定'}
        </button>
      </div>

      {/* 手動備份 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">立即備份</h2>
        <p className="text-sm text-gray-500">立即將所有資料備份至 Google Drive，包含學校、計畫、結算、帳戶等完整資料。</p>
        {backupMsg && <p className={`text-sm font-medium ${backupMsg.startsWith('✅') ? 'text-green-700' : 'text-red-600'}`}>{backupMsg}</p>}
        <button onClick={runBackup} disabled={backing || !settings.backup_folder_id}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm cursor-pointer flex items-center gap-2">
          {backing ? <><Spinner />備份中...</> : '📥 立即備份'}
        </button>
        {!settings.backup_folder_id && <p className="text-xs text-orange-500">請先設定備份資料夾 ID</p>}
      </div>

      {/* 備份清單 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">備份記錄</h2>
          <button onClick={loadBackups} disabled={loadingList}
            className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">
            {loadingList ? <Spinner /> : '↻ 重新整理'}
          </button>
        </div>
        {loadingList ? <BlockSpinner /> : backups.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">尚無備份記錄</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">類型</th>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">時間</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium">大小</th>
                <th className="text-center px-4 py-2 text-gray-500 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.map(f => (
                <tr key={f.fileId} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {TYPE_LABELS[f.type] || f.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {new Date(f.createdTime).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500">
                    {(f.size / 1024).toFixed(0)} KB
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => { setRestoreModal(f); setConfirmText(''); setRestoreResult(null); setRestoreScopes(Object.keys(SCOPE_LABELS)) }}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded cursor-pointer">
                        還原
                      </button>
                      <button onClick={() => deleteBackup(f.fileId)}
                        className="text-xs px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 rounded cursor-pointer">
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>


      {/* 還原 Modal */}
      {restoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">還原備份</h2>
              <button onClick={() => setRestoreModal(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">✕</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                ⚠️ 還原將覆蓋現有資料。建議先執行「立即備份」保存當前狀態。
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">選擇還原範圍：</p>
                <div className="space-y-2">
                  {Object.entries(SCOPE_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={restoreScopes.includes(key)}
                        onChange={e => setRestoreScopes(prev => e.target.checked ? [...prev, key] : prev.filter(s => s !== key))}
                        className="w-4 h-4 rounded" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">輸入「確認還原」以繼續：</p>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder="確認還原"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              {restoreResult && (
                <div className={`rounded-xl p-3 text-sm ${restoreResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {restoreResult.ok ? '✅ 還原完成' : '⚠️ 部分還原完成'}
                  <ul className="mt-1 text-xs space-y-0.5">
                    {Object.entries(restoreResult.results || {}).map(([k, n]) => (
                      <li key={k}>・{SCOPE_LABELS[k] || k}：{n} 筆</li>
                    ))}
                    {(restoreResult.errors || []).map((e, i) => <li key={i} className="text-red-600">✗ {e}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setRestoreModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm cursor-pointer hover:bg-gray-50">取消</button>
              <button onClick={doRestore} disabled={restoring || confirmText !== '確認還原' || !restoreScopes.length}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-medium cursor-pointer">
                {restoring ? <span className="flex items-center justify-center gap-2"><Spinner />還原中...</span> : '確認還原'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const GAS_CODE = `// ── 加入現有 GAS 腳本的備份相關程式碼 ──

function doPost(e) {
  const body = JSON.parse(e.postData.contents)
  const { action, secret } = body
  if (secret !== PropertiesService.getScriptProperties().getProperty('SECRET')) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: '驗證失敗' }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  // 在既有的 action 判斷中加入：
  if (action === 'backup_upload') return handleBackupUpload(body)
  if (action === 'backup_list')   return handleBackupList(body)
  if (action === 'backup_content') return handleBackupContent(body)
  if (action === 'backup_cleanup') return handleBackupCleanup(body)
  if (action === 'backup_setup_trigger') return handleSetupTrigger(body)
  if (action === 'backup_remove_trigger') return handleRemoveTrigger(body)
  // ... 其他既有 action
}

function handleBackupUpload(body) {
  const folder = DriveApp.getFolderById(body.folderId)
  const blob = Utilities.newBlob(body.content, 'application/json', body.filename)
  const file = folder.createFile(blob)
  return ok({ fileId: file.getId() })
}

function handleBackupList(body) {
  const folder = DriveApp.getFolderById(body.folderId)
  const iter = folder.getFilesByType('application/json')
  const files = []
  while (iter.hasNext()) {
    const f = iter.next()
    const name = f.getName()
    const type = name.includes('_scheduled_') ? 'scheduled'
               : name.includes('_school_year_') ? 'school_year' : 'manual'
    files.push({ fileId: f.getId(), name, type, size: f.getSize(), createdTime: f.getDateCreated().toISOString() })
  }
  files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
  return ok({ files })
}

function handleBackupContent(body) {
  const file = DriveApp.getFileById(body.fileId)
  return ok({ content: file.getBlob().getDataAsString() })
}

function handleBackupCleanup(body) {
  const folder = DriveApp.getFolderById(body.folderId)
  const iter = folder.getFilesByType('application/json')
  const scheduled = [], manual = []
  while (iter.hasNext()) {
    const f = iter.next()
    const name = f.getName()
    if (name.includes('_scheduled_')) scheduled.push(f)
    else if (name.includes('_manual_')) manual.push(f)
  }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (body.retainDays || 30))
  scheduled.filter(f => f.getDateCreated() < cutoff).forEach(f => f.setTrashed(true))
  manual.sort((a,b) => b.getDateCreated() - a.getDateCreated())
  manual.slice(body.retainManual || 10).forEach(f => f.setTrashed(true))
  return ok({})
}

function handleSetupTrigger(body) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runDailyBackup')
    .forEach(t => ScriptApp.deleteTrigger(t))
  PropertiesService.getScriptProperties().setProperties({
    BACKUP_URL: body.scheduledUrl + '/api/admin/backup',
    BACKUP_SECRET: body.triggerSecret
  })
  ScriptApp.newTrigger('runDailyBackup').timeBased().atHour(body.hour || 2).everyDays(1).create()
  return ok({ message: '定時觸發設定完成' })
}

function handleRemoveTrigger(body) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runDailyBackup')
    .forEach(t => ScriptApp.deleteTrigger(t))
  return ok({ message: '定時觸發已移除' })
}

// 每日定時備份（由 Time Trigger 呼叫）
function runDailyBackup() {
  const props = PropertiesService.getScriptProperties().getProperties()
  const url = props.BACKUP_URL
  const secret = props.BACKUP_SECRET
  if (!url || !secret) return
  UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({ trigger: 'scheduled', secret }),
    muteHttpExceptions: true
  })
}

function ok(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON)
}`
