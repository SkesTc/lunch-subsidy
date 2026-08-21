import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolIds, subject, message } = await req.json()
  if (!schoolIds?.length) return NextResponse.json({ error: '未選擇學校' }, { status: 400 })

  // 區管理者只能發送自己分區的學校
  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  const filteredIds: number[] = allowedIds !== null
    ? schoolIds.filter((id: number) => allowedIds.includes(id))
    : schoolIds
  if (!filteredIds.length) return NextResponse.json({ error: '無符合權限的學校' }, { status: 403 })

  const settings = await getAllSettings()
  const gasUrl = settings.gas_url || ''
  const gasSecret = settings.gas_secret || ''

  if (!gasUrl) return NextResponse.json({ error: '未設定 GAS 網址，請至系統設定填入' }, { status: 500 })

  const adminName = settings.admin_name || '承辦人員'
  const adminTitle = settings.admin_title || ''
  const adminPhone = settings.admin_phone || ''
  const hostSchool = settings.host_school || ''

  // 一次查詢取得帳號 + 學校 + 聯絡人資訊（取代逐一讀 Storage 檔案）
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('email, school_id, contact_name, contact_title, schools(name, code)')
    .in('school_id', filteredIds)
    .eq('is_admin', false)

  if (!profiles?.length) return NextResponse.json({ error: '找不到學校帳號' }, { status: 404 })

  // 平行發送所有通知（原本為 for...of 逐一發送）
  const results = await Promise.all(profiles.map(async profile => {
    const school = (profile.schools as unknown as { name: string; code: number } | null)
    const schoolName = school?.name || ''
    const bodyText = message
      .replace(/\{schoolName\}/g, schoolName)
      .replace(/\{adminName\}/g, adminName)
      .replace(/\{adminTitle\}/g, adminTitle)
      .replace(/\{adminPhone\}/g, adminPhone)
      .replace(/\{hostSchool\}/g, hostSchool)
      .replace(/\{contactName\}/g, profile.contact_name || '')
      .replace(/\{contactTitle\}/g, profile.contact_title || '')

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', secret: gasSecret, to: profile.email, subject, body: bodyText }),
      })
      const data = await res.json().catch(() => ({}))
      return { email: profile.email, school: schoolName, ok: res.ok && data.ok, error: data.error }
    } catch (e) {
      return { email: profile.email, school: schoolName, ok: false, error: String(e) }
    }
  }))

  const successCount = results.filter(r => r.ok).length
  return NextResponse.json({ ok: true, successCount, total: results.length, results })
}
