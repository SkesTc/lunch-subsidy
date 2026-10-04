import { auth } from '@/lib/auth'
import { getUserZoneRole, getZoneSchoolIds, isZoneAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'
import { buildNotifyRecipients } from '@/lib/notifyEmail'

// 區管理者只能對自己分區的學校操作
async function allowedSchoolIds(email: string, schoolIds: number[]) {
  const zoneUser = await getUserZoneRole(email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return null
  const allowed = await getZoneSchoolIds(zoneUser)
  return allowed !== null ? schoolIds.filter(id => allowed.includes(id)) : schoolIds
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { schoolIds, subject, message, semester, planId } = await req.json()
  if (!schoolIds?.length) return NextResponse.json({ error: '未選擇學校' }, { status: 400 })

  const filteredIds = await allowedSchoolIds(session.user.email, schoolIds)
  if (filteredIds === null) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  if (!filteredIds.length) return NextResponse.json({ error: '無符合權限的學校' }, { status: 403 })

  const { recipients, globalSettings } = await buildNotifyRecipients({
    schoolIds: filteredIds, subject, message, semester: Number(semester) || 1, planId: planId || null,
  })
  if (!recipients.length) return NextResponse.json({ error: '找不到學校帳號' }, { status: 404 })

  const gasUrl = globalSettings.gas_url || ''
  const gasSecret = globalSettings.gas_secret || ''
  if (!gasUrl) return NextResponse.json({ error: '未設定 GAS 網址，請至系統設定填入' }, { status: 500 })
  const bcc = globalSettings.bcc_enabled !== 'false' && globalSettings.bcc_email ? { bcc: globalSettings.bcc_email } : {}

  const results = await Promise.all(recipients.map(async r => {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', secret: gasSecret, to: r.email, subject: r.subject, body: r.text, htmlBody: r.html, noReply: true, ...bcc }),
      })
      const data = await res.json().catch(() => ({}))
      return { email: r.email, school: r.schoolName, ok: res.ok && data.ok, error: data.error }
    } catch (e) {
      return { email: r.email, school: r.schoolName, ok: false, error: String(e) }
    }
  }))

  const successCount = results.filter(r => r.ok).length
  return NextResponse.json({ ok: true, successCount, total: results.length, results })
}
