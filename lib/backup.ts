import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings, readGlobalSettingsRaw } from '@/lib/settings'
import { getGasSettings } from '@/lib/gas'

export type BackupType = 'manual' | 'scheduled' | 'school_year'

// ── 共用：查詢所有資料並組裝備份 JSON ───────────────────────────
export async function buildBackupPayload(type: 'manual' | 'scheduled' | 'school_year') {
  const [settings, globalSettings] = await Promise.all([getAllSettings(), readGlobalSettingsRaw()])

  const [
    { data: schools },
    { data: plans },
    { data: planAmounts },
    { data: schoolAmounts },
    { data: settlements },
    { data: bankAccounts },
    { data: changeRequests },
    { data: userProfiles },
  ] = await Promise.all([
    supabaseAdmin.from('schools').select('*').order('code'),
    supabaseAdmin.from('plans').select('*').order('sort_order'),
    supabaseAdmin.from('plan_amounts').select('*'),
    supabaseAdmin.from('school_amounts').select('*'),
    supabaseAdmin.from('settlements').select('*'),
    supabaseAdmin.from('bank_accounts').select('*'),
    supabaseAdmin.from('change_requests').select('*').order('created_at'),
    supabaseAdmin.from('user_profiles').select('*'),
  ])

  return {
    version: '1.1',
    type,
    created_at: new Date().toISOString(),
    system_name: settings.system_name || '',
    data: {
      schools: schools || [],
      plans: plans || [],
      plan_amounts: planAmounts || [],
      school_amounts: schoolAmounts || [],
      settlements: settlements || [],
      bank_accounts: bankAccounts || [],
      change_requests: changeRequests || [],
      user_profiles: userProfiles || [],
    },
    settings: globalSettings,
  }
}

async function gasNotify(gasUrl: string, gasSecret: string, to: string, subject: string, body: string) {
  await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'notify', secret: gasSecret, to, subject, body }),
  }).catch(() => {})
}

// 執行一次備份（手動、定時、測試通知共用）。notify：scheduled 寄完成/失敗通知、test 寄測試信
export async function runBackup(opts: { type: BackupType; notify: 'none' | 'scheduled' | 'test' }): Promise<{ status: number; body: Record<string, unknown> }> {
  const { type, notify } = opts
  const settings = await getAllSettings()
  const { gasUrl, gasSecret } = await getGasSettings()
  const backupFolderId = settings.backup_folder_id as string

  if (!gasUrl) return { status: 400, body: { error: '請先設定 GAS 網址' } }
  if (!backupFolderId) return { status: 400, body: { error: '請先設定備份資料夾 ID' } }
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(backupFolderId)) {
    return { status: 400, body: { error: '備份資料夾 ID 格式不正確，請確認從 Google Drive 資料夾網址複製正確的 ID' } }
  }
  const notifyEmail = settings.backup_notify_email ? String(settings.backup_notify_email) : ''

  try {
    const payload = await buildBackupPayload(type)
    const json = JSON.stringify(payload, null, 2)
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
    const filename = `backup_${type}_${ts}.json`

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup_upload', secret: gasSecret, folderId: backupFolderId, filename, content: json }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '上傳失敗')

    const retainDays = Number(settings.backup_retain_daily) || 30
    const retainManual = Number(settings.backup_retain_manual) || 10
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'backup_cleanup', secret: gasSecret, folderId: backupFolderId, retainDays, retainManual }),
    }).catch(() => {})

    const shouldNotify = notify !== 'none' && !!notifyEmail
    if (shouldNotify) {
      const sizeMB = (json.length / 1024 / 1024).toFixed(2)
      const isTest = notify === 'test'
      await gasNotify(gasUrl, gasSecret, notifyEmail,
        isTest ? '【核銷系統】[測試] 定時備份完成通知' : '【核銷系統】定時備份完成通知',
        `${isTest ? '（此為管理員手動觸發的測試信，非實際定時備份）\n\n' : ''}備份類型：${type}\n時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n檔案：${filename}（${sizeMB} MB）\n\n系統已自動上傳至 Google Drive 備份資料夾。`)
    }
    return { status: 200, body: { ok: true, filename, fileId: data.fileId, notified: shouldNotify } }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (notify === 'scheduled' && notifyEmail) {
      await gasNotify(gasUrl, gasSecret, notifyEmail, '【核銷系統】定時備份失敗通知',
        `備份失敗時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n原因：${msg}\n\n請登入後台手動執行備份。`)
    }
    return { status: 500, body: { error: msg || '備份失敗' } }
  }
}
