import { auth } from '@/lib/auth'
import { getGlobalSettings } from '@/lib/settings'
import { getGasSettings } from '@/lib/gas'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'
import { runBackup, type BackupType } from '@/lib/backup'

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

  const type = isTrigger ? 'scheduled' : (body.type || 'manual') as BackupType
  const notify = isTrigger ? 'scheduled' : body.testNotify === true ? 'test' : 'none'
  const { status, body: result } = await runBackup({ type, notify })
  return NextResponse.json(result, { status })
}

// ── GET /api/admin/backup → 列出備份清單 ─────────────────────────
export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const settings = await getGlobalSettings()
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
