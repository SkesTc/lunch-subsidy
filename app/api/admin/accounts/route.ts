import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateProfileCache } from '@/lib/profile-cache'
import { getUserZoneRole, getZoneSchoolIds, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const zoneUser = await getUserZoneRole(session.user.email!)
  const schoolIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  let query = supabaseAdmin
    .from('user_profiles')
    .select('id, email, school_id, is_admin, role, zone_id, contact_name, contact_title, contact_phone, schools(name, code, district)')
    .order('email')

  if (schoolIds !== null) {
    query = query.in('school_id', schoolIds.length ? schoolIds : [-1])
  }

  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const caller = await getUserZoneRole(session.user.email!)
  if (!caller || !isSuperAdmin(caller)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { email, role, zone_id } = await req.json()
  if (!email || !email.includes('@')) return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })

  const adminRole = role || 'zone_admin'
  const { data: existing } = await supabaseAdmin
    .from('user_profiles').select('id').eq('email', email).single()

  if (existing) {
    await supabaseAdmin.from('user_profiles').update({ is_admin: true, role: adminRole, zone_id: zone_id || null }).eq('email', email)
  } else {
    await supabaseAdmin.from('user_profiles').insert({ email, is_admin: true, role: adminRole, zone_id: zone_id || null })
  }
  invalidateProfileCache(email)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const caller = await getUserZoneRole(session.user.email!)
  if (!caller || !isSuperAdmin(caller)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { email } = await req.json()
  if (email === session.user.email) return NextResponse.json({ error: '無法刪除自己的帳號' }, { status: 400 })

  await supabaseAdmin.from('user_profiles').delete().eq('email', email)
  invalidateProfileCache(email)
  return NextResponse.json({ ok: true })
}

const ALLOWED_UPDATE_KEYS = new Set(['school_id', 'contact_name', 'contact_title', 'contact_phone'])
const SUPER_ONLY_KEYS = new Set(['role', 'zone_id'])

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { email, updates } = await req.json()
  const caller = await getUserZoneRole(session.user.email!)
  const callerIsSuper = caller && isSuperAdmin(caller)

  const safeUpdates: Record<string, unknown> = {}
  for (const key of Object.keys(updates || {})) {
    if (ALLOWED_UPDATE_KEYS.has(key)) safeUpdates[key] = updates[key]
    else if (SUPER_ONLY_KEYS.has(key) && callerIsSuper) safeUpdates[key] = updates[key]
  }
  if (Object.keys(safeUpdates).length === 0) {
    return NextResponse.json({ error: '無有效更新欄位' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(safeUpdates)
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (safeUpdates.school_id !== undefined) {
    invalidateProfileCache(email)
  }
  return NextResponse.json({ ok: true })
}
