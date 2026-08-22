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

  // 非管理員不可進入 /admin（用 session is_admin 即可，不涉及 school_id）
  if (pathname.startsWith('/admin') && !session.user?.is_admin) {
    return NextResponse.redirect(new URL('/school', req.url))
  }

  // school_id 綁定狀態改由各 Server Component（app/page.tsx、bind-school/layout.tsx、school/page.tsx）
  // 以 DB 為準判斷，避免 JWT session 過期導致 middleware 與 layout 互相重定向

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
