import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin, isZoneAdmin } from '@/lib/zones'

import { NextResponse } from 'next/server'

// GET /api/admin/plans
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const schoolYear = searchParams.get('school_year')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabaseAdmin.from('plans').select('*').order('sort_order')
  if (schoolYear) query = query.eq('school_year', schoolYear)

  // 區管理員只看包含自己區別的計畫
  if (!isSuperAdmin(zoneUser) && zoneUser.zone_id) {
    query = query.contains('zone_ids', [zoneUser.zone_id])
  }

  const { data } = await query
  return NextResponse.json(data || [])
}

// POST /api/admin/plans — 新增計畫
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const body = await req.json()
  const { zone_ids, name, label, plan_type, school_year, semester, require_repay, deduct_s1_repay,
          deadline, open_note, sort_order, is_active, is_open } = body

  // 確認 zone_ids：區管理員只能設定自己的區
  let resolvedZoneIds: number[] = Array.isArray(zone_ids) ? zone_ids.map(Number) : []
  if (!isSuperAdmin(zoneUser) && zoneUser.zone_id) {
    resolvedZoneIds = [zoneUser.zone_id]
  }
  if (resolvedZoneIds.length === 0) return NextResponse.json({ error: '請選擇至少一個區別' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '請填寫計畫名稱' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('plans')
    .insert({
      zone_ids: resolvedZoneIds,
      zone_id: resolvedZoneIds[0],
      name, label: label || name, plan_type: plan_type || 'lunch',
      school_year: school_year || '', semester: semester ?? null,
      require_repay: require_repay ?? false, deduct_s1_repay: deduct_s1_repay ?? false,
      deadline: deadline || '', open_note: open_note || '',
      sort_order: sort_order ?? 0, is_active: is_active ?? true, is_open: is_open ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/admin/plans — 更新計畫
export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const body = await req.json()
  const { id, name, label, plan_type, school_year, semester, is_active, is_open, sort_order,
          require_repay, deduct_s1_repay, deadline, open_note, zone_ids } = body

  // 確認計畫屬於有權限的區
  const { data: plan } = await supabaseAdmin.from('plans').select('zone_ids, zone_id').eq('id', id).single()
  if (!plan) return NextResponse.json({ error: '計畫不存在' }, { status: 404 })

  // 檢查權限：super_admin 可改任何；zone_admin 需在 zone_ids 中
  if (!isSuperAdmin(zoneUser)) {
    const planZones: number[] = plan.zone_ids || (plan.zone_id ? [plan.zone_id] : [])
    if (!zoneUser.zone_id || !planZones.includes(zoneUser.zone_id)) {
      return NextResponse.json({ error: '無權限修改此計畫' }, { status: 403 })
    }
  }

  const payload: Record<string, unknown> = {}
  if (name !== undefined) payload.name = name
  if (label !== undefined) payload.label = label
  if (plan_type !== undefined) payload.plan_type = plan_type
  if (school_year !== undefined) payload.school_year = school_year
  if (semester !== undefined) payload.semester = semester
  if (is_active !== undefined) payload.is_active = is_active
  if (is_open !== undefined) payload.is_open = is_open
  if (sort_order !== undefined) payload.sort_order = sort_order
  if (require_repay !== undefined) payload.require_repay = require_repay
  if (deduct_s1_repay !== undefined) payload.deduct_s1_repay = deduct_s1_repay
  if (deadline !== undefined) payload.deadline = deadline
  if (open_note !== undefined) payload.open_note = open_note
  if (zone_ids !== undefined && isSuperAdmin(zoneUser)) {
    const ids = Array.isArray(zone_ids) ? zone_ids.map(Number) : []
    payload.zone_ids = ids
    if (ids.length > 0) payload.zone_id = ids[0]
  }

  const { error } = await supabaseAdmin.from('plans').update(payload).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/plans — 刪除計畫
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  // super_admin 直接刪除，不需查 zone_ids（避免欄位不存在時失敗）
  if (!isSuperAdmin(zoneUser)) {
    const { data: plan } = await supabaseAdmin.from('plans').select('zone_ids, zone_id').eq('id', id).single()
    if (!plan) return NextResponse.json({ error: '計畫不存在' }, { status: 404 })
    const planZones: number[] = plan.zone_ids || (plan.zone_id ? [plan.zone_id] : [])
    if (!zoneUser.zone_id || !planZones.includes(zoneUser.zone_id)) {
      return NextResponse.json({ error: '無權限刪除此計畫' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin.from('plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
