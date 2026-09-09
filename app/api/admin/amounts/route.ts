import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { writeLog } from '@/lib/operationLog'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()
  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  let query = supabaseAdmin
    .from('school_amounts').select('school_id, school_year, sem1_amount, sem2_amount, approved_total').eq('school_year', schoolYear)
  if (allowedIds !== null) query = query.in('school_id', allowedIds.length ? allowedIds : [-1])
  const { data } = await query
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { school_id, school_year, sem1_amount, sem2_amount } = await req.json()
  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  if (allowedIds !== null && !allowedIds.includes(Number(school_id))) {
    return NextResponse.json({ error: '無權限修改此學校的金額' }, { status: 403 })
  }
  const approved_total = (sem1_amount || 0) + (sem2_amount || 0)

  const { data: existing } = await supabaseAdmin
    .from('school_amounts').select('id').eq('school_id', school_id).eq('school_year', school_year).single()

  if (existing) {
    await supabaseAdmin.from('school_amounts')
      .update({ sem1_amount, sem2_amount, approved_total })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('school_amounts')
      .insert({ school_id, school_year, sem1_amount, sem2_amount, approved_total })
  }

  const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', school_id).single()
  writeLog({
    actorEmail: session.user.email!,
    actorRole: 'admin',
    schoolId: Number(school_id),
    schoolName: school?.name,
    action: 'update_amounts',
    detail: `修改核定金額（${school_year}學年度）：第1學期 NT$ ${(sem1_amount || 0).toLocaleString()}、第2學期 NT$ ${(sem2_amount || 0).toLocaleString()}`,
    metadata: { school_year, sem1_amount, sem2_amount },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
