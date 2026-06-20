import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

function contactPath(email: string) {
  // Safe filename: replace special chars
  const safe = email.replace('@', '_at_').replace(/\./g, '_')
  return `__contacts/${safe}.json`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({})

  const { data } = await supabaseAdmin.storage.from(BUCKET).download(contactPath(session.user.email))
  if (!data) return NextResponse.json({})
  try {
    return NextResponse.json(JSON.parse(await data.text()))
  } catch {
    return NextResponse.json({})
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { contactName, contactTitle, contactPhone } = await req.json()
  const payload = { contact_name: contactName, contact_title: contactTitle, contact_phone: contactPhone }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(contactPath(session.user.email), blob, { upsert: true, contentType: 'application/json' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also try updating DB columns in case migration has been run
  await supabaseAdmin.from('user_profiles')
    .update({ contact_name: contactName, contact_phone: contactPhone })
    .eq('email', session.user.email)

  return NextResponse.json({ ok: true })
}
