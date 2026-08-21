import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { SCHOOLS_DATA } from '@/lib/schools-data'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

// 一次性資料初始化：將90校核定資料寫入資料庫
// 呼叫方式：POST /api/admin/seed（需管理員身份）
export async function POST() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { error } = await supabaseAdmin.from('schools').upsert(
    SCHOOLS_DATA.map(s => ({
      code: s.code,
      district: s.district,
      name: s.name,
      approved_total: s.approved_total,
      sem1_amount: s.sem1_amount,
      sem2_amount: s.sem2_amount,
    })),
    { onConflict: 'code' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: SCHOOLS_DATA.length })
}
