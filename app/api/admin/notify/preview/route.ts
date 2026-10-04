import { auth } from '@/lib/auth'
import { getUserZoneRole, getZoneSchoolIds, isZoneAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'
import { buildNotifyRecipients } from '@/lib/notifyEmail'

// 預覽某校實際會收到的催收信（不寄出）
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const zoneUser = await getUserZoneRole(session.user.email)
  if (!zoneUser || !isZoneAdmin(zoneUser)) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolId, subject, message, semester, planId } = await req.json()
  const allowed = await getZoneSchoolIds(zoneUser)
  if (allowed !== null && !allowed.includes(schoolId)) return NextResponse.json({ error: '無權限預覽此學校' }, { status: 403 })

  const { recipients } = await buildNotifyRecipients({
    schoolIds: [schoolId], subject: subject || '', message: message || '', semester: Number(semester) || 1, planId: planId || null,
  })
  if (!recipients.length) return NextResponse.json({ error: '此校尚未綁定帳號，收不到通知' }, { status: 404 })
  const r = recipients[0]
  return NextResponse.json({ to: recipients.map(x => x.email), subject: r.subject, html: r.html })
}
