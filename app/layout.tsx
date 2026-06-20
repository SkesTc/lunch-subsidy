import type { Metadata } from 'next'
import './globals.css'
import { getSystemSettings } from '@/lib/settings'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings()
  const name = settings.system_name || '免費營養午餐核銷系統'
  return {
    title: name,
    description: `${settings.school_year || '115'}學年度 ${name}`,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
