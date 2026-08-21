// 僅供測試環境使用，正式環境不部署此檔案
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '僅測試環境可用' }, { status: 403 })
  }

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: '請提供 email' }, { status: 400 })

  // 建立或更新 user_profiles 為超級管理員
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .upsert({
      email,
      is_admin: true,
      role: 'super_admin',
      zone_id: null,
    }, { onConflict: 'email' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, message: `${email} 已設為超級管理員` })
}
