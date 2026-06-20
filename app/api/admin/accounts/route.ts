import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

function contactPath(email: string) {
  const safe = email.replace('@', '_at_').replace(/\./g, '_')
  return `__contacts/${safe}.json`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  let result = await supabaseAdmin
    .from('user_profiles')
    .select('id, email, school_id, is_admin, schools(name, code, district)')
    .order('email')

  const accounts = result.data || []

  // Fetch contact info from Storage for each account
  const withContact = await Promise.all(
    accounts.map(async (a) => {
      try {
        const { data: blob } = await supabaseAdmin.storage
          .from('settlement-files')
          .download(contactPath(a.email))
        if (blob) {
          const parsed = JSON.parse(await blob.text())
          return {
            ...a,
            contact_name: parsed.contact_name || '',
            contact_title: parsed.contact_title || '',
            contact_phone: parsed.contact_phone || '',
          }
        }
      } catch {
        // no contact file yet
      }
      return { ...a, contact_name: '', contact_title: '', contact_phone: '' }
    })
  )

  return NextResponse.json(withContact)
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

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { email } = await req.json()
  if (email === session.user.email) return NextResponse.json({ error: '無法刪除自己的帳號' }, { status: 400 })

  await supabaseAdmin.from('user_profiles').delete().eq('email', email)
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
  return NextResponse.json({ ok: true })
}
