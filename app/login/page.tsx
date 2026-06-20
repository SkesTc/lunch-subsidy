'use client'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'

function LoginContent() {
  const params = useSearchParams()
  const error = params.get('error')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<{ system_name: string; host_school: string; admin_name: string; admin_title: string; admin_phone: string; school_year: string } | null>(null)

  useEffect(() => {
    fetch('/api/settings/public').then(r => r.json()).then(d => {
      setSettings({
        system_name: d.system_name || '免費營養午餐核銷系統',
        host_school: d.host_school || '',
        admin_name: d.admin_name || '',
        admin_title: d.admin_title || '',
        admin_phone: d.admin_phone || '',
        school_year: d.school_year || '115',
      })
    }).catch(() => {})
  }, [])

  function handleSignIn() {
    setLoading(true)
    signIn('google', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm space-y-3">

        {/* 主卡片 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/60">

          {/* 上半部藍色色塊 */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-8 pt-9 pb-8 text-center text-white">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl shadow-inner backdrop-blur-sm">
              🍱
            </div>
            <h1 className="text-base font-bold leading-snug tracking-wide">
              {settings?.system_name || '免費營養午餐核銷系統'}
            </h1>
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              <span className="text-xs font-medium">{settings?.school_year || '115'} 學年度</span>
            </div>
          </div>

          {/* 下半部登入區 */}
          <div className="px-8 py-7 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-xs text-center">
                登入失敗，請確認您使用學校 Gmail 帳號登入
              </div>
            )}

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md disabled:opacity-50 text-slate-700 font-medium py-3 px-6 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">登入中，請稍候...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm">以 Google 帳號登入</span>
                </>
              )}
            </button>

            <p className="text-xs text-center text-slate-400">請使用學校或教育局核准之 Gmail 帳號</p>
          </div>
        </div>

        {/* 底部聯絡資訊 */}
        {settings && (settings.host_school || settings.admin_name || settings.admin_phone) && (
          <div className="text-center text-xs text-slate-500 space-y-0.5 py-1">
            {settings.host_school && <p>承辦學校：{settings.host_school}</p>}
            {(settings.admin_name || settings.admin_phone) && (
              <p>聯絡人：{settings.admin_name}{settings.admin_title}{settings.admin_phone ? `　${settings.admin_phone}` : ''}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
