import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings, invalidateSettingsCache } from '@/lib/settings'
import { getGasSettings } from '@/lib/gas'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'
const SETTINGS_PATH = '__system/settings.json'

// ── 共用：查詢所有資料並組裝備份 JSON ───────────────────────────
async function buildBackupPayload(type: 'manual' | 'scheduled' | 'school_year') {
  const settings = await getAllSettings()

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
    settings,
  }
}

// ── POST /api/admin/backup → 手動備份 ────────────────────────────
export async function POST(req: Request) {
  // 支援兩種呼叫方式：管理員 session 或 GAS 定時觸發
  const body = await req.json().catch(() => ({}))
  const isTrigger = body.trigger === 'scheduled'

  if (isTrigger) {
    // 定時觸發：沿用 GAS 驗證金鑰（gas_secret）驗證
    const { gasSecret } = await getGasSettings()
    if (!gasSecret || body.secret !== gasSecret) {
      return NextResponse.json({ error: '驗證失敗' }, { status: 403 })
    }
  } else {
    // 手動觸發：驗證管理員 session，限 super_admin
    const session = await auth()
    if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })
    const zoneUser = await getUserZoneRole(session.user.email!)
    if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })
  }

  const type = isTrigger ? 'scheduled' : (body.type || 'manual') as 'manual' | 'scheduled' | 'school_year'
  const settings = await getAllSettings()
  const { gasUrl, gasSecret } = await getGasSettings()
  const backupFolderId = settings.backup_folder_id as string

  if (!gasUrl) return NextResponse.json({ error: '請先設定 GAS 網址' }, { status: 400 })
  if (!backupFolderId) return NextResponse.json({ error: '請先設定備份資料夾 ID' }, { status: 400 })
  // 基本格式驗證（Google Drive folder ID 通常 28-33 字元）
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(backupFolderId)) {
    return NextResponse.json({ error: '備份資料夾 ID 格式不正確，請確認從 Google Drive 資料夾網址複製正確的 ID' }, { status: 400 })
  }

  try {
    const payload = await buildBackupPayload(type)
    const json = JSON.stringify(payload, null, 2)
    const now = new Date()
    const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15)
    const filename = `backup_${type}_${ts}.json`

    // 上傳至 Google Drive
    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'backup_upload',
        secret: gasSecret,
        folderId: backupFolderId,
        filename,
        content: json,
      }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error || '上傳失敗')

    // 清理舊備份
    const retainDays = Number(settings.backup_retain_daily) || 30
    const retainManual = Number(settings.backup_retain_manual) || 10
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'backup_cleanup',
        secret: gasSecret,
        folderId: backupFolderId,
        retainDays,
        retainManual,
      }),
    }).catch(() => {})

    // 定時備份：寄通知信
    if (isTrigger && settings.backup_notify_email && gasUrl) {
      const notifyEmail = String(settings.backup_notify_email)
      const sizeMB = (json.length / 1024 / 1024).toFixed(2)
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          secret: gasSecret,
          to: notifyEmail,
          subject: `【核銷系統】定時備份完成通知`,
          body: `備份類型：${type}\n時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n檔案：${filename}（${sizeMB} MB）\n\n系統已自動上傳至 Google Drive 備份資料夾。`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, filename, fileId: data.fileId })
  } catch (e) {
    // 失敗時寄通知
    const settings2 = await getAllSettings()
    if (isTrigger && settings2.backup_notify_email && gasUrl) {
      const { gasSecret: gs } = await getGasSettings()
      fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          secret: gs,
          to: String(settings2.backup_notify_email),
          subject: `【核銷系統】⚠️ 定時備份失敗通知`,
          body: `備份失敗時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}\n原因：${e instanceof Error ? e.message : String(e)}\n\n請登入後台手動執行備份。`,
        }),
      }).catch(() => {})
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : '備份失敗' }, { status: 500 })
  }
}

// ── GET /api/admin/backup → 列出備份清單 ─────────────────────────
export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const settings = await getAllSettings()
  const { gasUrl, gasSecret } = await getGasSettings()
  const backupFolderId = settings.backup_folder_id as string

  if (!gasUrl || !backupFolderId) return NextResponse.json([])

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'backup_list', secret: gasSecret, folderId: backupFolderId }),
  })
  const data = await res.json()
  return NextResponse.json(data.files || [])
}

// ── DELETE /api/admin/backup → 刪除備份 ──────────────────────────
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })
  const zoneUserDel = await getUserZoneRole(session.user.email!)
  if (!zoneUserDel || !isSuperAdmin(zoneUserDel)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { fileId } = await req.json()
  const { gasUrl, gasSecret } = await getGasSettings()
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', secret: gasSecret, fileId }),
  })
  const data = await res.json()
  return NextResponse.json({ ok: data.ok })
}
