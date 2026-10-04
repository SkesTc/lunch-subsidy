import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin, isZoneAdmin } from '@/lib/zones'

import { NextResponse } from 'next/server'
import { PLAN_STATUSES, aggregateStatus, isPlanStatus, planStatusOf, type PlanStatus } from '@/lib/planStatus'

// GET /api/admin/plans
const MISSING_STATUS_COLUMN = '請先在 Supabase 執行 lib/migration-plan-status.sql（新增計畫狀態欄位），才能使用「已結案」'
const isMissingStatusColumn = (msg?: string) => !!msg && /status/.test(msg) && /column|schema cache/i.test(msg)
const MISSING_SEMESTER_STATUS = '請先在 Supabase 執行 lib/migration-plan-semester-status.sql（新增各學期送件狀態欄位），才能分開設定兩個學期'
const isMissingSemesterStatusColumn = (msg?: string) => !!msg && /semester_status/.test(msg)

function sanitizeSemesterStatus(v: unknown): Partial<Record<'1' | '2', PlanStatus>> {
  const out: Partial<Record<'1' | '2', PlanStatus>> = {}
  if (v && typeof v === 'object') {
    for (const k of ['1', '2'] as const) {
      const st = (v as Record<string, unknown>)[k]
      if (isPlanStatus(st)) out[k] = st
    }
  }
  return out
}

// 由請求取得送件狀態，並同步舊欄位 is_open
function statusFields(status: unknown, isOpen: unknown): { status?: PlanStatus; is_open?: boolean } {
  if (typeof status === 'string' && (PLAN_STATUSES as string[]).includes(status)) return { status: status as PlanStatus, is_open: status === 'open' }
  if (typeof isOpen === 'boolean') return { status: isOpen ? 'open' : 'not_open', is_open: isOpen }
  return {}
}

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
          deadline, open_note, sort_order, is_active, is_open, status } = body

  // 確認 zone_ids：區管理員只能設定自己的區
  let resolvedZoneIds: number[] = Array.isArray(zone_ids) ? zone_ids.map(Number) : []
  if (!isSuperAdmin(zoneUser) && zoneUser.zone_id) {
    resolvedZoneIds = [zoneUser.zone_id]
  }
  if (resolvedZoneIds.length === 0) return NextResponse.json({ error: '請選擇至少一個區別' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '請填寫計畫名稱' }, { status: 400 })

  // 全年計畫可帶入各學期狀態，計畫層級狀態取兩學期綜合
  const semStatus = (semester ?? null) === null ? sanitizeSemesterStatus(body.semester_status) : {}
  const hasSemStatus = Object.keys(semStatus).length > 0
  const sf = hasSemStatus
    ? statusFields(aggregateStatus([semStatus['1'] ?? 'not_open', semStatus['2'] ?? 'not_open']), undefined)
    : statusFields(status ?? 'not_open', is_open)
  const row = {
      zone_ids: resolvedZoneIds,
      zone_id: resolvedZoneIds[0],
      name, label: label || name, plan_type: plan_type || 'lunch',
      school_year: school_year || '', semester: semester ?? null,
      require_repay: require_repay ?? false, deduct_s1_repay: deduct_s1_repay ?? false,
      deadline: deadline || '', open_note: open_note || '',
      sort_order: sort_order ?? 0, is_active: is_active ?? true, ...sf,
      ...(hasSemStatus ? { semester_status: semStatus } : {}),
  }
  let { data, error } = await supabaseAdmin.from('plans').insert(row).select().single()
  if (error && isMissingSemesterStatusColumn(error.message)) {
    if (semStatus['1'] !== semStatus['2']) return NextResponse.json({ error: MISSING_SEMESTER_STATUS }, { status: 400 })
    const { semester_status: _omitSem, ...withoutSem } = row as typeof row & { semester_status?: unknown }  // eslint-disable-line @typescript-eslint/no-unused-vars
    ;({ data, error } = await supabaseAdmin.from('plans').insert(withoutSem).select().single())
  }
  if (error && isMissingStatusColumn(error.message)) {
    if (sf.status === 'closed') return NextResponse.json({ error: MISSING_STATUS_COLUMN }, { status: 400 })
    const { status: _omit, ...legacy } = row  // eslint-disable-line @typescript-eslint/no-unused-vars
    ;({ data, error } = await supabaseAdmin.from('plans').insert(legacy).select().single())
  }

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
  const { id, name, label, plan_type, school_year, semester, is_active, is_open, status, sort_order,
          require_repay, deduct_s1_repay, deadline, open_note, zone_ids } = body

  // 確認計畫屬於有權限的區
  const { data: plan } = await supabaseAdmin.from('plans').select('*').eq('id', id).single()
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
  // 全年計畫：可只切換某一學期（status + status_semester），或一次送出兩學期（semester_status）
  const planSemester = semester !== undefined ? semester : plan.semester
  const statusSemester = body.status_semester === 1 || body.status_semester === 2 ? String(body.status_semester) as '1' | '2' : null
  if (planSemester == null && (statusSemester || body.semester_status !== undefined)) {
    const merged = { ...sanitizeSemesterStatus(plan.semester_status), ...sanitizeSemesterStatus(body.semester_status) }
    if (statusSemester && isPlanStatus(status)) merged[statusSemester] = status
    const s1 = merged['1'] ?? planStatusOf(plan, 1)
    const s2 = merged['2'] ?? planStatusOf(plan, 2)
    payload.semester_status = { '1': s1, '2': s2 }
    Object.assign(payload, statusFields(aggregateStatus([s1, s2]), undefined))
  } else {
    Object.assign(payload, statusFields(status, is_open))
  }
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

  let { error } = await supabaseAdmin.from('plans').update(payload).eq('id', id)
  if (error && isMissingSemesterStatusColumn(error.message)) {
    return NextResponse.json({ error: MISSING_SEMESTER_STATUS }, { status: 400 })
  }
  if (error && isMissingStatusColumn(error.message)) {
    if (payload.status === 'closed') return NextResponse.json({ error: MISSING_STATUS_COLUMN }, { status: 400 })
    delete payload.status
    ;({ error } = await supabaseAdmin.from('plans').update(payload).eq('id', id))
  }
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

  // 先刪除 plan_amounts（FK 可能為 RESTRICT），再刪計畫
  await supabaseAdmin.from('plan_amounts').delete().eq('plan_id', id)
  const { error } = await supabaseAdmin.from('plans').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
