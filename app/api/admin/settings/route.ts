import { auth } from '@/lib/auth'
import { DEFAULTS, readGlobalSettingsRaw, writeGlobalSettings } from '@/lib/settings'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

async function readSettings() {
  return { ...DEFAULTS, ...(await readGlobalSettingsRaw()) }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const settings = await readSettings()
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) {
    // 區管理者不需看到敏感金鑰
    const { gas_secret: _s, gas_url: _u, drive_folder_id: _d, ...safeSettings } = settings
    return NextResponse.json(safeSettings)
  }
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const updates = await req.json()
  try {
    await writeGlobalSettings(updates)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
