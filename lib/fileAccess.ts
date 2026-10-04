import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'

// 管理者能否存取某個檔案：超級管理者全部可；區管理者只能存取自己分區學校的檔案
export async function canAdminAccessFile(email: string, path: string): Promise<boolean> {
  const zoneUser = await getUserZoneRole(email)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  if (allowedIds === null) return true

  const [{ data: scan }, { data: remit }, { data: pending }] = await Promise.all([
    supabaseAdmin.from('settlements').select('school_id').eq('scan_file_path', path).limit(1),
    supabaseAdmin.from('settlements').select('school_id').eq('remittance_file_path', path).limit(1),
    supabaseAdmin.from('change_requests').select('school_id').eq('pending_file_path', path).limit(1),
  ])
  const owner = [...(scan || []), ...(remit || []), ...(pending || [])][0]?.school_id as number | undefined
  return owner !== undefined && allowedIds.includes(owner)
}
