import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // 公開頁面
  if (pathname === '/login') return NextResponse.next()

  // 未登入 → 導向登入頁
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // 已登入但未綁定學校（非管理員）→ 導向綁定頁
  if (!session.user?.school_id && !session.user?.is_admin && pathname !== '/bind-school') {
    return NextResponse.redirect(new URL('/bind-school', req.url))
  }

  // 非管理員不可進入 /admin
  if (pathname.startsWith('/admin') && !session.user?.is_admin) {
    return NextResponse.redirect(new URL('/school', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
