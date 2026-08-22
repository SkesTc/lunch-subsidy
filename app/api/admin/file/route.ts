import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasDeleteFile } from '@/lib/gas'
import { getUserZoneRole, isSuperAdmin, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: '無路徑' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage
    .from('settlement-files')
    .createSignedUrl(path, 300)

  if (error || !data?.signedUrl) return NextResponse.json({ error: '無法產生連結' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })
  const zoneUser = await getUserZoneRole(session.user.email!)

  const { settlementId, fileType } = await req.json()

  const { data: settle } = await supabaseAdmin
    .from('settlements').select('id, school_id, semester, scan_file_path, remittance_file_path')
    .eq('id', settlementId).single()

  if (!settle) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  // zone_admin 只能刪自己分區的學校
  if (zoneUser && !isSuperAdmin(zoneUser)) {
    const allowedIds = await getZoneSchoolIds(zoneUser)
    if (allowedIds !== null && !allowedIds.includes(settle.school_id)) {
      return NextResponse.json({ error: '無權限刪除此學校檔案' }, { status: 403 })
    }
  }

  const filePath = fileType === 'scan' ? settle.scan_file_path : settle.remittance_file_path
  if (!filePath) return NextResponse.json({ error: '無檔案' }, { status: 400 })

  // Delete from storage
  if (!filePath.includes('/')) {
    // Google Drive file ID → delete via GAS
    try {
      const { gasUrl, gasSecret } = await getGasSettings()
      if (gasUrl) await gasDeleteFile({ gasUrl, gasSecret, fileId: filePath })
    } catch (e) {
      console.error('GAS delete failed:', e)
      // non-fatal: continue to clear DB
    }
  } else {
    // Legacy Supabase Storage path
    await supabaseAdmin.storage.from('settlement-files').remove([filePath])
  }

  // Clear DB field
  const updateData: Record<string, null | string> = {}
  if (fileType === 'scan') {
    updateData.scan_file_path = null
    updateData.scan_uploaded_at = null
    updateData.status = 'downloaded'
  } else {
    updateData.remittance_file_path = null
    updateData.remittance_date = null
  }

  await supabaseAdmin.from('settlements').update(updateData).eq('id', settlementId)

  return NextResponse.json({ ok: true })
}
