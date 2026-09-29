import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'

export interface BatchPrintItem {
  school_id: number
  code: number
  name: string
  path: string
}

// 依學校編號排序，列出指定學期（＋計畫）已核准的結算表掃描檔或送款憑單
export async function getBatchPrintList(opts: {
  userEmail: string
  type: 'scan' | 'remittance'
  semester: 1 | 2
  planId: string | null
  schoolYear?: string
}): Promise<BatchPrintItem[]> {
  const schoolYear = opts.schoolYear || await getActiveSchoolYear()
  const zoneUser = await getUserZoneRole(opts.userEmail)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  const schoolBaseQuery = supabaseAdmin.from('schools').select('id, code, name').eq('is_active', true).order('code')
  const schoolFinalQuery = allowedIds !== null ? schoolBaseQuery.in('id', allowedIds.length ? allowedIds : [-1]) : schoolBaseQuery

  const fileField = opts.type === 'scan' ? 'scan_file_path' : 'remittance_file_path'
  const settleQuery = opts.planId
    ? supabaseAdmin.from('settlements').select(`school_id, ${fileField}`).eq('school_year', schoolYear).eq('plan_id', opts.planId).eq('semester', opts.semester)
    : supabaseAdmin.from('settlements').select(`school_id, ${fileField}`).eq('school_year', schoolYear).eq('semester', opts.semester).is('plan_id', null)

  const [{ data: schools }, { data: settles }] = await Promise.all([schoolFinalQuery, settleQuery])

  const fileMap = new Map((settles || []).map(s => [(s as Record<string, unknown>).school_id as number, (s as Record<string, unknown>)[fileField] as string | null]))

  return (schools || [])
    .map(s => ({ school_id: s.id, code: s.code, name: s.name, path: fileMap.get(s.id) || null }))
    .filter((s): s is BatchPrintItem => !!s.path)
}
