import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin, isZoneAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

// 依傳入順序重新設定計畫排序（拖拉排序用）：sort_order = 10, 20, 30…
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: '排序資料格式錯誤' }, { status: 400 })
  }

  // 區管理者只能調整含有自己分區的計畫
  if (!isSuperAdmin(zoneUser)) {
    const { data: plans } = await supabaseAdmin.from('plans').select('id, zone_ids, zone_id').in('id', ids)
    const allowed = (plans || []).every(p => {
      const zones: number[] = p.zone_ids || (p.zone_id ? [p.zone_id] : [])
      return zoneUser.zone_id != null && zones.includes(zoneUser.zone_id)
    })
    if (!allowed || (plans || []).length !== ids.length) return NextResponse.json({ error: '無權限調整部分計畫的排序' }, { status: 403 })
  }

  const results = await Promise.all(ids.map((id: string, i: number) =>
    supabaseAdmin.from('plans').update({ sort_order: (i + 1) * 10 }).eq('id', id)
  ))
  const failed = results.find(r => r.error)
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
