import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasGetFolderUrl } from '@/lib/gas'
import { getUserZoneRole } from '@/lib/zones'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

// GET /api/admin/drive-folder
// 依登入者的分區動態取得 Google Drive 資料夾 URL
export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const [{ gasUrl, gasSecret, driveFolderId }, schoolYear, zoneUser] = await Promise.all([
    getGasSettings(),
    getActiveSchoolYear(),
    session.user.email ? getUserZoneRole(session.user.email) : Promise.resolve(null),
  ])

  if (!gasUrl || !driveFolderId) {
    return NextResponse.json({ url: driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : null })
  }

  // 取分區名稱
  let zoneName = ''
  if (zoneUser?.zone_id) {
    const { data: zone } = await supabaseAdmin.from('zones').select('name').eq('id', zoneUser.zone_id).single()
    zoneName = zone?.name || ''
  }

  // subFolder 路徑：含分區層
  const subFolder = zoneName ? `${schoolYear}學年度/${zoneName}` : `${schoolYear}學年度`

  const folderUrl = await gasGetFolderUrl({ gasUrl, gasSecret, folderId: driveFolderId, subFolder })

  // fallback：若 GAS 尚未支援 getFolderUrl，直接回根資料夾
  return NextResponse.json({
    url: folderUrl || `https://drive.google.com/drive/folders/${driveFolderId}`,
  })
}
