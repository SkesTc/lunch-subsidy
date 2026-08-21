import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { id, sem1_amount, sem2_amount } = await req.json()
  const approved_total = (sem1_amount || 0) + (sem2_amount || 0)

  const { error } = await supabaseAdmin
    .from('schools')
    .update({ sem1_amount, sem2_amount, approved_total })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
