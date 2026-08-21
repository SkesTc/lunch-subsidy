import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings } from '@/lib/gas'
import { getAllSettings } from '@/lib/settings'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const { fileId, scopes } = await req.json()
  if (!fileId || !scopes?.length) return NextResponse.json({ error: '缺少參數' }, { status: 400 })

  const settings = await getAllSettings()
  const { gasUrl, gasSecret } = await getGasSettings()

  // 從 Drive 下載備份內容
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'backup_content', secret: gasSecret, fileId }),
  })
  const gasData = await res.json()
  if (!gasData.ok) return NextResponse.json({ error: gasData.error || '下載失敗' }, { status: 500 })

  let backup: Record<string, unknown>
  try {
    backup = JSON.parse(gasData.content)
  } catch {
    return NextResponse.json({ error: '備份檔案格式錯誤' }, { status: 400 })
  }

  const data = backup.data as Record<string, unknown[]>
  const results: Record<string, number> = {}
  const errors: string[] = []

  const tableMap: Record<string, string> = {
    schools: 'schools',
    plans: 'plans',
    plan_amounts: 'plan_amounts',
    school_amounts: 'school_amounts',
    settlements: 'settlements',
    bank_accounts: 'bank_accounts',
    change_requests: 'change_requests',
    user_profiles: 'user_profiles',
  }

  for (const scope of scopes) {
    const table = tableMap[scope]
    if (!table || !data[scope]?.length) continue
    try {
      const { error } = await supabaseAdmin.from(table).upsert(data[scope] as Record<string, unknown>[], { ignoreDuplicates: false })
      if (error) { errors.push(`${table}: ${error.message}`); continue }
      results[scope] = data[scope].length
    } catch (e) {
      errors.push(`${scope}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 還原系統設定
  if (scopes.includes('settings') && backup.settings) {
    const settingsJson = JSON.stringify({ ...settings, ...(backup.settings as object) }, null, 2)
    const blob = new Blob([settingsJson], { type: 'application/json' })
    await supabaseAdmin.storage.from('settlement-files').upload('__system/settings.json', blob, { upsert: true, contentType: 'application/json' })
    results['settings'] = 1
  }

  return NextResponse.json({ ok: errors.length === 0, results, errors })
}
