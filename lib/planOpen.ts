import { supabaseAdmin } from '@/lib/supabase'
import { getGlobalSettings } from '@/lib/settings'
import { planStatusOf, type PlanStatus } from '@/lib/planStatus'

export const PLAN_CLOSED_MESSAGE = '目前未開放送件，資料僅供檢視；如需修改請聯絡承辦人員'

// 送件狀態：計畫模式依計畫狀態（未開放／已開放／已結案）；學期模式依系統設定期程開關（第1學期末 block2、第2學期末 block3）
export async function getSubmissionStatus(planId: string | null | undefined, semester: number | string | null | undefined): Promise<PlanStatus> {
  if (planId) {
    const { data } = await supabaseAdmin.from('plans').select('*').eq('id', planId).maybeSingle()
    return planStatusOf(data)
  }
  const s = await getGlobalSettings()
  const open = Number(semester) === 2 ? s.block3_open !== 'false' : s.block2_open !== 'false'
  return open ? 'open' : 'not_open'
}

// 只有「已開放」可以填報、上傳或申請修改
export async function isSubmissionOpen(planId: string | null | undefined, semester: number | string | null | undefined): Promise<boolean> {
  return (await getSubmissionStatus(planId, semester)) === 'open'
}
