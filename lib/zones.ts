import { supabaseAdmin } from '@/lib/supabase'

export interface Zone {
  id: number
  name: string
  host_school: string
  host_email: string
  is_active: boolean
}

export interface Plan {
  id: string
  zone_ids: number[]
  name: string
  label: string
  school_year: string
  is_open: boolean
  sort_order: number
}

export type UserRole = 'super_admin' | 'zone_admin' | 'school'

export interface ZoneUser {
  role: UserRole
  zone_id: number | null
  is_admin: boolean
}

// ── 快取 ──────────────────────────────────────────
let _zonesCache: { data: Zone[]; ts: number } | null = null
const TTL = 30_000

// ── 區別 ─────────────────────────────────────────

export async function getAllZones(): Promise<Zone[]> {
  if (_zonesCache && Date.now() - _zonesCache.ts < TTL) return _zonesCache.data
  const { data } = await supabaseAdmin.from('zones').select('*').eq('is_active', true).order('id')
  const result = data || []
  _zonesCache = { data: result, ts: Date.now() }
  return result
}

export async function getZoneById(zoneId: number): Promise<Zone | null> {
  const zones = await getAllZones()
  return zones.find(z => z.id === zoneId) || null
}

// ── 計畫 ─────────────────────────────────────────

export async function getPlansByZone(zoneId: number): Promise<Plan[]> {
  const { data } = await supabaseAdmin
    .from('plans')
    .select('*')
    .contains('zone_ids', [zoneId])
    .eq('is_open', true)
    .order('sort_order')
  return data || []
}

export async function getPlanById(planId: string): Promise<Plan | null> {
  const { data } = await supabaseAdmin.from('plans').select('*').eq('id', planId).single()
  return data || null
}

// ── 區別設定 ─────────────────────────────────────

export async function getZoneSettings(zoneId: number, planId?: number): Promise<Record<string, string>> {
  // 先取區層級設定
  const { data: zoneRows } = await supabaseAdmin
    .from('zone_settings')
    .select('key, value')
    .eq('zone_id', zoneId)
    .is('plan_id', null)

  const result: Record<string, string> = {}
  for (const row of zoneRows || []) result[row.key] = row.value

  // 再疊加計畫層級設定（覆蓋同名 key）
  if (planId) {
    const { data: planRows } = await supabaseAdmin
      .from('zone_settings')
      .select('key, value')
      .eq('zone_id', zoneId)
      .eq('plan_id', planId)

    for (const row of planRows || []) result[row.key] = row.value
  }

  return result
}

export async function saveZoneSettings(zoneId: number, planId: number | null, settings: Record<string, string>) {
  // PostgreSQL 的 UNIQUE 約束對 NULL 不相等，所以 upsert 在 plan_id=NULL 時會重複插入
  // 改為逐筆 delete + insert 避免重複
  const keys = Object.keys(settings)
  if (keys.length === 0) return

  const baseQ = supabaseAdmin.from('zone_settings').delete().eq('zone_id', zoneId)
  const deleteQ = planId !== null
    ? baseQ.eq('plan_id', planId).in('key', keys)
    : baseQ.is('plan_id', null).in('key', keys)
  await deleteQ

  const rows = Object.entries(settings).map(([key, value]) => ({
    zone_id: zoneId,
    plan_id: planId,
    key,
    value,
    updated_at: new Date().toISOString(),
  }))
  await supabaseAdmin.from('zone_settings').insert(rows)
}

// ── 使用者角色判斷 ────────────────────────────────

export async function getUserZoneRole(email: string): Promise<ZoneUser | null> {
  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('is_admin, zone_id, role')
    .eq('email', email)
    .single()

  if (!data) return null

  // 向下相容：舊資料沒有 role 欄位時，依 is_admin 推斷
  const role: UserRole = data.role || (data.is_admin ? 'zone_admin' : 'school')

  return {
    role,
    zone_id: data.zone_id || null,
    is_admin: data.is_admin || false,
  }
}

export function isSuperAdmin(zoneUser: ZoneUser) {
  return zoneUser.role === 'super_admin'
}

export function isZoneAdmin(zoneUser: ZoneUser) {
  return zoneUser.role === 'zone_admin' || zoneUser.role === 'super_admin'
}

export function canAccessZone(zoneUser: ZoneUser, zoneId: number) {
  if (zoneUser.role === 'super_admin') return true
  return zoneUser.zone_id === zoneId
}

// Returns null for super admin (no filter needed), or school_ids array for zone admin
export async function getZoneSchoolIds(zoneUser: ZoneUser): Promise<number[] | null> {
  if (isSuperAdmin(zoneUser) || !zoneUser.zone_id) return null
  const { data } = await supabaseAdmin
    .from('schools').select('id').eq('zone_id', zoneUser.zone_id)
  return (data || []).map(s => s.id)
}
