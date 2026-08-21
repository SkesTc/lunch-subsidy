import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

// GET — 列出所有管理員
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅超級管理員可操作' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, is_admin, role, zone_id')
    .eq('is_admin', true)
    .order('email')

  return NextResponse.json(data || [])
}

// POST — 新增或更新管理員角色
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅超級管理員可操作' }, { status: 403 })

  const { email, role, zone_id } = await req.json()
  if (!email || !role) return NextResponse.json({ error: '請填寫 email 和角色' }, { status: 400 })

  const payload = {
    email,
    is_admin: true,
    role,
    zone_id: role === 'super_admin' ? null : (zone_id || null),
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .upsert(payload, { onConflict: 'email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — 移除管理員權限
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅超級管理員可操作' }, { status: 403 })

  const { email } = await req.json()
  if (email === session.user.email) return NextResponse.json({ error: '不能移除自己的管理員權限' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ is_admin: false, role: 'school' })
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
