import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings } from '@/lib/gas'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import { NextResponse } from 'next/server'

// POST /api/admin/init-drive-folders
// 在 Google Drive 根資料夾下建立所有分區的子資料夾
export async function POST() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅限超級管理者' }, { status: 403 })

  const [{ gasUrl, gasSecret, driveFolderId }, schoolYear, { data: zones }] = await Promise.all([
    getGasSettings(),
    getActiveSchoolYear(),
    supabaseAdmin.from('zones').select('id, name').order('id'),
  ])

  if (!gasUrl || !gasSecret || !driveFolderId) {
    return NextResponse.json({ error: '請先在系統設定填入 GAS 網址與 Drive 資料夾 ID' }, { status: 400 })
  }

  if (!zones || zones.length === 0) {
    return NextResponse.json({ error: '尚未建立任何分區' }, { status: 400 })
  }

  const paths = zones.map((z: { name: string }) => `${schoolYear}學年度/${z.name}`)

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'createFolders', secret: gasSecret, folderId: driveFolderId, paths }),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data.ok) {
    return NextResponse.json({ error: data.error || 'GAS 建立失敗' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, paths })
}
