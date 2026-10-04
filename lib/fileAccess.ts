import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'

// 帳戶變更附件存在 __account-changes/<學校ID>_<學年度>.json，需逐檔確認 file_id 屬於該校
export async function isAccountChangeAttachment(schoolId: number, path: string): Promise<boolean> {
  const { data: files } = await supabaseAdmin.storage.from('settlement-files').list('__account-changes', { search: `${schoolId}_` })
  for (const f of files || []) {
    if (!f.name.startsWith(`${schoolId}_`)) continue
    const { data } = await supabaseAdmin.storage.from('settlement-files').download(`__account-changes/${f.name}`)
    try {
      if (data && JSON.parse(await data.text()).file_id === path) return true
    } catch { /* 略過格式錯誤的檔案 */ }
  }
  return false
}

// 管理者能否存取某個檔案：超級管理者全部可；區管理者只能存取自己分區學校的檔案
// schoolHint 僅用於帳戶變更附件，且仍會在後端確認檔案確實屬於該校
export async function canAdminAccessFile(email: string, path: string, schoolHint?: number): Promise<boolean> {
  const zoneUser = await getUserZoneRole(email)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  if (allowedIds === null) return true

  const [{ data: scan }, { data: remit }, { data: pending }] = await Promise.all([
    supabaseAdmin.from('settlements').select('school_id').eq('scan_file_path', path).limit(1),
    supabaseAdmin.from('settlements').select('school_id').eq('remittance_file_path', path).limit(1),
    supabaseAdmin.from('change_requests').select('school_id').eq('pending_file_path', path).limit(1),
  ])
  const owner = [...(scan || []), ...(remit || []), ...(pending || [])][0]?.school_id as number | undefined
  if (owner !== undefined) return allowedIds.includes(owner)

  if (schoolHint !== undefined && allowedIds.includes(schoolHint)) return isAccountChangeAttachment(schoolHint, path)
  return false
}

// 學校帳號能否存取某個檔案：只能是自己學校的結算表、送款憑單、待審檔案或帳戶變更附件
export async function schoolOwnsFile(schoolId: number, path: string): Promise<boolean> {
  if (path.includes('/')) return path.startsWith(`${schoolId}/`)
  const [{ data: scan }, { data: remit }, { data: pending }] = await Promise.all([
    supabaseAdmin.from('settlements').select('id').eq('school_id', schoolId).eq('scan_file_path', path).limit(1),
    supabaseAdmin.from('settlements').select('id').eq('school_id', schoolId).eq('remittance_file_path', path).limit(1),
    supabaseAdmin.from('change_requests').select('id').eq('school_id', schoolId).eq('pending_file_path', path).limit(1),
  ])
  if ((scan?.length || 0) + (remit?.length || 0) + (pending?.length || 0) > 0) return true
  return isAccountChangeAttachment(schoolId, path)
}
