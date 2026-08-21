import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') || '200')
  const search = searchParams.get('search') || ''

  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  let query = supabaseAdmin
    .from('login_logs')
    .select('id, email, school_id, is_admin, ip, user_agent, created_at, schools(name, code)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (search) query = query.ilike('email', `%${search}%`)
  if (allowedIds !== null) {
    // 區管理員：顯示區內學校登入 + 管理員本身（school_id = null）
    const idList = allowedIds.length ? allowedIds.join(',') : '-1'
    query = query.or(`school_id.is.null,school_id.in.(${idList})`)
  }

  const { data } = await query
  return NextResponse.json(data || [])
}
