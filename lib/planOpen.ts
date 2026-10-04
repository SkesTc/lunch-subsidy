import { supabaseAdmin } from '@/lib/supabase'
import { getGlobalSettings } from '@/lib/settings'

export const PLAN_CLOSED_MESSAGE = '目前未開放送件，資料僅供檢視；如需修改請聯絡承辦人員'

// 是否開放送件：計畫模式看該計畫的開關；學期模式看系統設定的期程開關（第1學期末 block2、第2學期末 block3）
export async function isSubmissionOpen(planId: string | null | undefined, semester: number | string | null | undefined): Promise<boolean> {
  if (planId) {
    const { data } = await supabaseAdmin.from('plans').select('is_open').eq('id', planId).maybeSingle()
    return data?.is_open === true
  }
  const s = await getGlobalSettings()
  return Number(semester) === 2 ? s.block3_open !== 'false' : s.block2_open !== 'false'
}
