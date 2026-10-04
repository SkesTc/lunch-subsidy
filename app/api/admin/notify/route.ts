import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGlobalSettings, getSettingsForZone, getGlobalSystemName } from '@/lib/settings'
import { getUserZoneRole, getZoneSchoolIds, isZoneAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'
import { wrapEmailHtml } from '@/lib/email-html'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { schoolIds, subject, message } = await req.json()
  if (!schoolIds?.length) return NextResponse.json({ error: '未選擇學校' }, { status: 400 })

  // 區管理者只能發送自己分區的學校
  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const allowedIds = await getZoneSchoolIds(zoneUser)
  const filteredIds: number[] = allowedIds !== null
    ? schoolIds.filter((id: number) => allowedIds.includes(id))
    : schoolIds
  if (!filteredIds.length) return NextResponse.json({ error: '無符合權限的學校' }, { status: 403 })

  const globalSettings = await getGlobalSettings()
  const gasUrl = globalSettings.gas_url || ''
  const gasSecret = globalSettings.gas_secret || ''
  if (!gasUrl) return NextResponse.json({ error: '未設定 GAS 網址，請至系統設定填入' }, { status: 500 })
  const globalSystemName = await getGlobalSystemName()
  const bcc = globalSettings.bcc_enabled !== 'false' && globalSettings.bcc_email ? { bcc: globalSettings.bcc_email } : {}

  // 依「收件學校所屬分區」套用該區的承辦人資訊（超級管理者可一次發給多個分區的學校）
  const { data: schoolZones } = await supabaseAdmin.from('schools').select('id, zone_id').in('id', filteredIds)
  const schoolZoneMap = new Map((schoolZones || []).map(s => [s.id as number, (s.zone_id as number | null) ?? null]))
  const zoneIds = [...new Set([...schoolZoneMap.values()].filter((z): z is number => z !== null))]
  const [{ data: zoneRows }, zoneSettingsList] = await Promise.all([
    supabaseAdmin.from('zones').select('id, name').in('id', zoneIds.length ? zoneIds : [-1]),
    Promise.all(zoneIds.map(z => getSettingsForZone(z))),
  ])
  const zoneSettingsMap = new Map(zoneIds.map((z, i) => [z, zoneSettingsList[i]]))
  const zoneNameMap = new Map((zoneRows || []).map(z => [z.id as number, z.name as string]))

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
    const zoneId = schoolZoneMap.get(profile.school_id as number) ?? null
    const settings = (zoneId !== null && zoneSettingsMap.get(zoneId)) || globalSettings
    const adminName = settings.admin_name || '承辦人員'
    const adminTitle = settings.admin_title || ''
    const adminPhone = settings.admin_phone || ''
    const hostSchool = settings.host_school || ''
    const zoneName = settings.system_name || ''
    const zoneShortName = (zoneId !== null && zoneNameMap.get(zoneId)) || String(settings.system_name || '')
    const bodyText = message
      .replace(/\{schoolName\}/g, schoolName)
      .replace(/\{adminName\}/g, adminName)
      .replace(/\{adminTitle\}/g, adminTitle)
      .replace(/\{adminPhone\}/g, adminPhone)
      .replace(/\{hostSchool\}/g, hostSchool)
      .replace(/\{zoneName\}/g, zoneName)
      .replace(/\{contactName\}/g, profile.contact_name || '')
      .replace(/\{contactTitle\}/g, profile.contact_title || '')

    try {
      const htmlBody = wrapEmailHtml({ body: bodyText, zoneName: zoneShortName, systemName: globalSystemName, hostSchool, adminName, adminTitle, adminPhone })
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', secret: gasSecret, to: profile.email, subject, body: bodyText, htmlBody, noReply: true, ...bcc }),
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
