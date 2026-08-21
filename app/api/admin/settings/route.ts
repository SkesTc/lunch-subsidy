import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateSettingsCache } from '@/lib/settings'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'
const PATH = '__system/settings.json'

const DEFAULTS = {
  system_name: '臺中市第2區免費營養午餐核銷系統',
  host_school: '',
  school_year: '115',
  admin_name: '',
  admin_title: '',
  admin_phone: '',
  plan_name: '學年度第　學期公立國中小免費營養午餐計畫經費',
  manual_url: '',
  drive_folder_id: '',
  gas_url: '',
  gas_secret: '',
  notify_subject: '【核銷系統】請儘速完成資料上傳',
  notify_body: '{schoolName} 您好，\n\n提醒您尚有核銷資料尚未完成上傳，請儘速登入系統完成作業。\n\n如有問題請聯絡承辦人員：{adminName}　{adminPhone}\n\n臺中市政府教育局',
  review_approve_subject: '【核銷系統】{semLabel}申請已核准',
  review_approve_body: '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請已核准通過。\n\n{actionNote}\n\n{adminNote}臺中市第2區免費營養午餐核銷系統',
  review_reject_subject: '【核銷系統】{semLabel}申請未通過',
  review_reject_body: '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請未通過審核。\n\n{adminNote}如有疑問請聯絡承辦人員。\n\n臺中市第2區免費營養午餐核銷系統',
  block1_open: 'true',
  block1_deadline: '115學年度開學後',
  block2_open: 'true',
  block2_deadline: '2026-02-15',
  block3_open: 'false',
  block3_deadline: '2026-06-30',
  // legacy keys kept for backward compat
  sem1_deadline: '2026-02-15',
  sem2_deadline: '2026-06-30',
  sem1_open: 'true',
  sem2_open: 'false',
}

async function readSettings() {
  const { data } = await supabaseAdmin.storage.from(BUCKET).download(PATH)
  if (!data) return { ...DEFAULTS }
  try {
    const text = await data.text()
    return { ...DEFAULTS, ...JSON.parse(text) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const settings = await readSettings()
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) {
    // 區管理者不需看到敏感金鑰
    const { gas_secret: _s, gas_url: _u, drive_folder_id: _d, ...safeSettings } = settings
    return NextResponse.json(safeSettings)
  }
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const updates = await req.json()
  const current = await readSettings()
  const merged = { ...current, ...updates }

  const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' })
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(PATH, blob, { upsert: true, contentType: 'application/json' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  invalidateSettingsCache()
  return NextResponse.json({ ok: true })
}
