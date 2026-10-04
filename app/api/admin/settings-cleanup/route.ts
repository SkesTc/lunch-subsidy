import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULTS, ZONE_KEYS, getSettingsForZone, readGlobalSettingsRaw, replaceGlobalSettingsRaw } from '@/lib/settings'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'

// 已無程式讀取的舊版學期制欄位
const LEGACY_GLOBAL_KEYS = ['sem1_deadline', 'sem2_deadline', 'sem1_open', 'sem2_open']
const ZONE_KEY_LABELS: Record<string, string> = {
  host_school: '承辦學校', admin_name: '承辦人姓名', admin_title: '承辦人職稱', admin_phone: '承辦人電話',
  block1_open: '帳戶確認開放', block1_deadline: '帳戶確認截止說明',
}

async function requireSuperAdmin() {
  const session = await auth()
  if (!session?.user?.is_admin) return false
  const zoneUser = await getUserZoneRole(session.user.email!)
  return !!zoneUser && isSuperAdmin(zoneUser)
}

// 計算清理內容與各分區的實際影響（預覽與執行共用）
async function buildPlan() {
  const raw = await readGlobalSettingsRaw()
  const removeKeys = [...ZONE_KEYS, ...LEGACY_GLOBAL_KEYS].filter(k => k in raw)

  const [{ data: zones }, { data: zoneRows }, { data: legacyRows }] = await Promise.all([
    supabaseAdmin.from('zones').select('id, name, host_school').order('id'),
    supabaseAdmin.from('zone_settings').select('zone_id, key, value').is('plan_id', null),
    supabaseAdmin.from('zone_settings').select('id, zone_id, plan_id, key, value').not('plan_id', 'is', null),
  ])

  const impacts: { zone: string; label: string; before: string; after: string }[] = []
  for (const z of zones || []) {
    const current = await getSettingsForZone(z.id)
    for (const key of ZONE_KEYS) {
      const own = (zoneRows || []).find(r => r.zone_id === z.id && r.key === key)?.value
      const after = key === 'host_school'
        ? (z.host_school || String(DEFAULTS.host_school))
        : (own || String(DEFAULTS[key] ?? ''))
      const before = String(current[key] ?? '')
      if (before !== after) impacts.push({ zone: z.name, label: ZONE_KEY_LABELS[key], before, after })
    }
  }

  return {
    raw,
    removeKeys,
    removeEntries: removeKeys.map(k => ({ key: k, label: ZONE_KEY_LABELS[k] || '舊版學期制欄位（已停用）', value: String(raw[k] ?? '') })),
    legacyRows: legacyRows || [],
    impacts,
  }
}

// GET：預覽將被清理的內容，不做任何修改
export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })
  const plan = await buildPlan()
  return NextResponse.json({
    removeEntries: plan.removeEntries,
    legacyRows: plan.legacyRows.map(r => ({ key: r.key, value: r.value, plan_id: r.plan_id })),
    impacts: plan.impacts,
    nothingToDo: plan.removeKeys.length === 0 && plan.legacyRows.length === 0,
  })
}

// POST：先備份，再清理
export async function POST() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })
  const plan = await buildPlan()
  if (plan.removeKeys.length === 0 && plan.legacyRows.length === 0) return NextResponse.json({ ok: true, nothingToDo: true })

  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
  const backupPath = `__system/backups/settings-before-cleanup-${ts}.json`
  const backup = new Blob([JSON.stringify({ settingsJson: plan.raw, removedZoneSettingRows: plan.legacyRows }, null, 2)], { type: 'application/json' })
  const { error: backupError } = await supabaseAdmin.storage.from('settlement-files').upload(backupPath, backup, { contentType: 'application/json' })
  if (backupError) return NextResponse.json({ error: `備份失敗，未進行清理：${backupError.message}` }, { status: 500 })

  const cleaned = Object.fromEntries(Object.entries(plan.raw).filter(([k]) => !plan.removeKeys.includes(k)))
  await replaceGlobalSettingsRaw(cleaned)

  if (plan.legacyRows.length > 0) {
    const { error } = await supabaseAdmin.from('zone_settings').delete().in('id', plan.legacyRows.map(r => r.id))
    if (error) return NextResponse.json({ error: `全域設定已清理，但舊分區資料刪除失敗：${error.message}`, backupPath }, { status: 500 })
  }

  return NextResponse.json({ ok: true, backupPath, removedKeys: plan.removeKeys.length, removedRows: plan.legacyRows.length })
}
