import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '台中市第2區免費營養午餐核銷系統',
  description: '115學年度公立國中小免費營養午餐（山區）第2區核銷資料上傳平台',
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
