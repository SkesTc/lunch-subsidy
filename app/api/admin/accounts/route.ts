import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateProfileCache } from '@/lib/profile-cache'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, school_id, is_admin, contact_name, contact_title, contact_phone, schools(name, code, district)')
    .order('email')

  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { email } = await req.json()
  if (!email || !email.includes('@')) return NextResponse.json({ error: '請輸入有效的 Email' }, { status: 400 })

  // Upsert: if user already exists, set is_admin=true; otherwise create pre-authorized record
  const { data: existing } = await supabaseAdmin
    .from('user_profiles').select('id').eq('email', email).single()

  if (existing) {
    await supabaseAdmin.from('user_profiles').update({ is_admin: true }).eq('email', email)
  } else {
    await supabaseAdmin.from('user_profiles').insert({ email, is_admin: true })
  }
  invalidateProfileCache(email)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { email } = await req.json()
  if (email === session.user.email) return NextResponse.json({ error: '無法刪除自己的帳號' }, { status: 400 })

  await supabaseAdmin.from('user_profiles').delete().eq('email', email)
  invalidateProfileCache(email)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { email, updates } = await req.json()
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(updates)
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 若異動 school_id 或 is_admin，清快取
  if (updates.school_id !== undefined || updates.is_admin !== undefined) {
    invalidateProfileCache(email)
  }
  return NextResponse.json({ ok: true })
}
