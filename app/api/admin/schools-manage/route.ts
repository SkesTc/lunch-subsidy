import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const { data } = await supabaseAdmin.from('schools').select('id, code, district, name, is_active').order('code')
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const { code, district, name } = await req.json()
  if (!code || !district || !name) return NextResponse.json({ error: '請填寫所有欄位' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('schools').insert({ code, district, name, is_active: true, approved_total: 0, sem1_amount: 0, sem2_amount: 0 }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const { id, is_active, code, district, name } = await req.json()
  const payload: Record<string, unknown> = {}
  if (is_active !== undefined) payload.is_active = is_active
  if (code !== undefined) payload.code = code
  if (district !== undefined) payload.district = district
  if (name !== undefined) payload.name = name
  await supabaseAdmin.from('schools').update(payload).eq('id', id)
  return NextResponse.json({ ok: true })
}
