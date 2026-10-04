import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Vercel 每日排程呼叫：對資料庫做一次極小的查詢，避免 Supabase 免費版因 7 天無存取而暫停
// Vercel 會自動帶上 Authorization: Bearer <CRON_SECRET>，未設定或不符一律拒絕
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: '尚未設定 CRON_SECRET' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: '驗證失敗' }, { status: 401 })
  }

  const { count, error } = await supabaseAdmin.from('schools').select('id', { count: 'exact', head: true })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, schools: count, at: new Date().toISOString() })
}
