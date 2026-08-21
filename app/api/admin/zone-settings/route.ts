import { auth } from '@/lib/auth'
import { getZoneSettings, saveZoneSettings, getUserZoneRole, isZoneAdmin, isSuperAdmin, canAccessZone } from '@/lib/zones'
import { invalidateSettingsCache } from '@/lib/settings'
import { NextResponse } from 'next/server'

// GET /api/admin/zone-settings?zone_id=2&plan_id=1
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const zoneId = Number(searchParams.get('zone_id')) || zoneUser.zone_id || 2
  const planId = searchParams.get('plan_id') ? Number(searchParams.get('plan_id')) : undefined

  // zone_admin 未指派 zone_id 時回傳空設定（而非 403）
  if (!canAccessZone(zoneUser, zoneId)) {
    if (!isSuperAdmin(zoneUser) && !zoneUser.zone_id) return NextResponse.json({})
    return NextResponse.json({ error: '無權限存取此區別' }, { status: 403 })
  }

  const settings = await getZoneSettings(zoneId, planId)
  return NextResponse.json(settings)
}

// POST /api/admin/zone-settings — 儲存設定
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { zone_id, plan_id, settings } = await req.json()
  const zoneId = Number(zone_id) || zoneUser.zone_id || 2

  if (!canAccessZone(zoneUser, zoneId)) return NextResponse.json({ error: '無權限存取此區別' }, { status: 403 })

  await saveZoneSettings(zoneId, plan_id ?? null, settings)
  invalidateSettingsCache()

  return NextResponse.json({ ok: true })
}
