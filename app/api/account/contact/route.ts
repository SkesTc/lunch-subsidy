import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({})

  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('contact_name, contact_title, contact_phone')
    .eq('email', session.user.email)
    .single()

  return NextResponse.json({
    contact_name: data?.contact_name || '',
    contact_title: data?.contact_title || '',
    contact_phone: data?.contact_phone || '',
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { contactName, contactTitle, contactPhone } = await req.json()

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ contact_name: contactName, contact_title: contactTitle, contact_phone: contactPhone })
    .eq('email', session.user.email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
