import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

async function getSettings() {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download('__system/settings.json')
    if (data) return JSON.parse(await data.text())
  } catch { /* ignore */ }
  return {}
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolIds, subject, message } = await req.json()
  if (!schoolIds?.length) return NextResponse.json({ error: '未選擇學校' }, { status: 400 })

  const settings = await getSettings()
  const gasUrl = settings.gas_url || ''
  const gasSecret = settings.gas_secret || ''

  if (!gasUrl) return NextResponse.json({ error: '未設定 GAS 網址，請至系統設定填入' }, { status: 500 })

  const adminName = settings.admin_name || '承辦人員'
  const adminPhone = settings.admin_phone || ''

  // Look up bound account emails for selected schools
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('email, school_id, schools(name, code)')
    .in('school_id', schoolIds)
    .eq('is_admin', false)

  if (!profiles?.length) return NextResponse.json({ error: '找不到學校帳號' }, { status: 404 })

  const results: { email: string; school: string; ok: boolean; error?: string }[] = []

  async function getContact(email: string) {
    try {
      const safe = email.replace('@', '_at_').replace(/\./g, '_')
      const { data } = await supabaseAdmin.storage.from(BUCKET).download(`__contacts/${safe}.json`)
      if (data) return JSON.parse(await data.text())
    } catch { /* ignore */ }
    return {}
  }

  for (const profile of profiles) {
    const school = (profile.schools as unknown as { name: string; code: number } | null)
    const schoolName = school?.name || ''
    const contact = await getContact(profile.email)
    const contactName = contact.contact_name || ''
    const contactTitle = contact.contact_title || ''
    const bodyText = message
      .replace(/\{schoolName\}/g, schoolName)
      .replace(/\{adminName\}/g, adminName)
      .replace(/\{adminPhone\}/g, adminPhone)
      .replace(/\{contactName\}/g, contactName)
      .replace(/\{contactTitle\}/g, contactTitle)

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          secret: gasSecret,
          to: profile.email,
          subject,
          body: bodyText,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        results.push({ email: profile.email, school: schoolName, ok: true })
      } else {
        results.push({ email: profile.email, school: schoolName, ok: false, error: data.error || '寄送失敗' })
      }
    } catch (e) {
      results.push({ email: profile.email, school: schoolName, ok: false, error: String(e) })
    }
  }

  const successCount = results.filter(r => r.ok).length
  return NextResponse.json({ ok: true, successCount, total: results.length, results })
}
