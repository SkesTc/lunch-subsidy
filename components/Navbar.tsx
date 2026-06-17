'use client'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

interface NavbarProps {
  schoolName?: string
  email?: string
  isAdmin?: boolean
}

export default function Navbar({ schoolName, email, isAdmin }: NavbarProps) {
  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow">
      <div className="flex items-center gap-3">
        <span className="text-xl">🍱</span>
        <div>
          <p className="font-bold text-sm leading-tight">台中市第2區 免費營養午餐核銷系統</p>
          <p className="text-blue-200 text-xs">115學年度・山區</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {isAdmin && (
          <Link href="/admin" className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg transition-colors">
            承辦後台
          </Link>
        )}
        <div className="text-right text-sm">
          {schoolName && <p className="font-medium">{schoolName}</p>}
          <p className="text-blue-200 text-xs">{email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs bg-blue-800 hover:bg-blue-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          登出
        </button>
      </div>
    </nav>
  )
}
