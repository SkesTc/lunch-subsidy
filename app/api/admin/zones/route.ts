import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin, isZoneAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

// GET /api/admin/zones — 列出所有區別（超級管理員）或自己的區（區管理員）
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  let query = supabaseAdmin.from('zones').select('*').order('id')

  // 非超級管理員只能看自己的區
  if (!isSuperAdmin(zoneUser) && zoneUser.zone_id) {
    query = query.eq('id', zoneUser.zone_id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST /api/admin/zones — 新增區別（僅超級管理員）
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅超級管理員可操作' }, { status: 403 })

  const { name, host_school, host_email } = await req.json()
  if (!name) return NextResponse.json({ error: '請填寫區別名稱' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('zones')
    .insert({ name, host_school: host_school || '', host_email: host_email || '' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/admin/zones — 更新區別
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { id, name, host_school, host_email, is_active } = await req.json()

  // 區管理員只能改自己的區
  if (!isSuperAdmin(zoneUser) && zoneUser.zone_id !== id) {
    return NextResponse.json({ error: '無權限修改其他區別' }, { status: 403 })
  }

  const payload: Record<string, unknown> = {}
  if (name !== undefined) payload.name = name
  if (host_school !== undefined) payload.host_school = host_school
  if (host_email !== undefined) payload.host_email = host_email
  if (is_active !== undefined && isSuperAdmin(zoneUser)) payload.is_active = is_active

  const { error } = await supabaseAdmin.from('zones').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
