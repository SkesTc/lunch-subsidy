import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'

const COOKIE = 'school_impersonate'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { school_id, school_name } = await req.json()
  if (!school_id) return NextResponse.json({ error: '缺少 school_id' }, { status: 400 })

  const cookieStore = await cookies()
  cookieStore.set(COOKIE, JSON.stringify({ school_id, school_name }), {
    httpOnly: false,  // client 可讀取以顯示 banner
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,  // 8小時
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
  return NextResponse.json({ ok: true })
}
