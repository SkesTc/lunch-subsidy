'use client'
import { signOut } from 'next-auth/react'
import Link from 'next/link'

interface NavbarProps {
  schoolName?: string
  email?: string
  isAdmin?: boolean
  schoolYear?: string
  systemName?: string
  manualUrl?: string
  adminManualUrl?: string
  currentPage?: 'admin' | 'school'
}

export default function Navbar({ schoolName, email, isAdmin, schoolYear, systemName, manualUrl, adminManualUrl, currentPage }: NavbarProps) {
  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow">
      <div className="flex items-center gap-3">
        <span className="text-xl">🍱</span>
        <div>
          <p className="font-bold text-sm leading-tight">{systemName || '免費營養午餐核銷系統'}</p>
          <p className="text-blue-200 text-xs">{schoolYear || '115'}學年度</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {isAdmin && currentPage === 'admin' && (
          <Link href="/school" className="text-sm bg-blue-500 hover:bg-blue-400 px-3 py-1 rounded-lg transition-colors">
            使用者模式
          </Link>
        )}
        {isAdmin && currentPage !== 'admin' && (
          <Link href="/admin" className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg transition-colors">
            承辦後台
          </Link>
        )}
        <div className="text-right text-sm">
          {schoolName && <p className="font-medium">{schoolName}</p>}
          <p className="text-blue-200 text-xs">{email}</p>
        </div>
        {(manualUrl || adminManualUrl) && (
          <a
            href={manualUrl || adminManualUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-blue-800 hover:bg-blue-900 px-3 py-1.5 rounded-lg transition-colors"
          >
            📄 使用說明
          </a>
        )}
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
