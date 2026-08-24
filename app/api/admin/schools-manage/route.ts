import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const zoneUser = await getUserZoneRole(session.user.email!)
  let query = supabaseAdmin.from('schools').select('id, code, district, name, is_active, zone_id').order('code')
  if (zoneUser && !isSuperAdmin(zoneUser) && zoneUser.zone_id) {
    query = query.eq('zone_id', zoneUser.zone_id)
  }
  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const callerZone = await getUserZoneRole(session.user.email!)
  if (!callerZone || !isSuperAdmin(callerZone)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })
  const { code, district, name, zone_id } = await req.json()
  if (!code || !district || !name) return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('schools').insert({ code, district, name, is_active: true, approved_total: 0, sem1_amount: 0, sem2_amount: 0, zone_id: zone_id || 2 }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const callerZone = await getUserZoneRole(session.user.email!)
  if (!callerZone || !isSuperAdmin(callerZone)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { id, force } = await req.json()
  if (!id) return NextResponse.json({ error: '缺少學校 ID' }, { status: 400 })

  // 檢查是否有關聯資料
  const [{ count: settleCount }, { count: amountCount }, { count: crCount }] = await Promise.all([
    supabaseAdmin.from('settlements').select('id', { count: 'exact', head: true }).eq('school_id', id),
    supabaseAdmin.from('school_amounts').select('school_id', { count: 'exact', head: true }).eq('school_id', id),
    supabaseAdmin.from('change_requests').select('id', { count: 'exact', head: true }).eq('school_id', id),
  ])
  const hasData = (settleCount ?? 0) > 0 || (amountCount ?? 0) > 0 || (crCount ?? 0) > 0

  if (hasData && !force) {
    return NextResponse.json({
      error: '此學校已有核銷或核定金額資料，無法刪除。如需停用請改用「停用」功能。',
      counts: { settlements: settleCount ?? 0, amounts: amountCount ?? 0, changeRequests: crCount ?? 0 },
    }, { status: 409 })
  }

  if (hasData && force) {
    // 強制刪除：先清除關聯資料（依外鍵順序）
    await supabaseAdmin.from('change_requests').delete().eq('school_id', id)
    await supabaseAdmin.from('settlements').delete().eq('school_id', id)
    await Promise.all([
      supabaseAdmin.from('school_amounts').delete().eq('school_id', id),
      supabaseAdmin.from('plan_amounts').delete().eq('school_id', id),
      supabaseAdmin.from('login_logs').delete().eq('school_id', id),
      supabaseAdmin.from('user_profiles').update({ school_id: null }).eq('school_id', id),
    ])
  }

  const { error } = await supabaseAdmin.from('schools').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const callerZone = await getUserZoneRole(session.user.email!)
  if (!callerZone || !isSuperAdmin(callerZone)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })
  const { id, is_active, code, district, name, zone_id } = await req.json()
  const payload: Record<string, unknown> = {}
  if (is_active !== undefined) payload.is_active = is_active
  if (code !== undefined) payload.code = code
  if (district !== undefined) payload.district = district
  if (name !== undefined) payload.name = name
  if (zone_id !== undefined) payload.zone_id = zone_id
  await supabaseAdmin.from('schools').update(payload).eq('id', id)
  return NextResponse.json({ ok: true })
}
