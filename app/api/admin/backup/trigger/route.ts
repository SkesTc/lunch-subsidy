import { auth } from '@/lib/auth'
import { getAllSettings, writeGlobalSettings } from '@/lib/settings'
import { getGasSettings } from '@/lib/gas'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'


// POST /api/admin/backup/trigger → 設定或取消 GAS 定時觸發
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const body = await req.json()
  const { enabled, hour, frequency, weekday, settings: newSettings } = body

  const currentSettings = await getAllSettings()
  const { gasUrl, gasSecret } = await getGasSettings()

  // 只儲存備份相關設定（不把分區合併後的整包設定寫回全域檔）
  await writeGlobalSettings(newSettings || {})

  if (!gasUrl) return NextResponse.json({ ok: true, gas: false, message: 'GAS 未設定，設定已儲存但無法設定定時觸發' })

  // 告知 GAS 設定或移除定時觸發
  // 定時觸發直接沿用 GAS 驗證金鑰（gasSecret），不需額外密鑰
  const siteUrl = newSettings.backup_scheduled_url || currentSettings.backup_scheduled_url || ''
  // 使用獨立端點 /api/backup-trigger，避免被 admin middleware 攔截
  const scheduledUrl = siteUrl ? siteUrl + '/api/backup-trigger' : ''

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: enabled ? 'backup_setup_trigger' : 'backup_remove_trigger',
      secret: gasSecret,
      hour: hour ?? 2,
      frequency: frequency || 'daily',
      weekday: weekday ?? 2,
      scheduledUrl,
      triggerSecret: gasSecret,
    }),
  })
  const data = await res.json().catch(() => ({}))
  const gasMsg = data.message || data.error || ''

  return NextResponse.json({ ok: true, gas: data.ok ?? false, message: gasMsg })
}
