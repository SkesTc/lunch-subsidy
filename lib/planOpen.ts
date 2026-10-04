import { supabaseAdmin } from '@/lib/supabase'

export const PLAN_CLOSED_MESSAGE = '本計畫已關閉送件，資料僅供檢視；如需修改請聯絡承辦人員'

// 計畫是否開放送件（未指定計畫的學期制一律視為開放，沿用原本的期程設定）
export async function isPlanOpen(planId: string | null | undefined): Promise<boolean> {
  if (!planId) return true
  const { data } = await supabaseAdmin.from('plans').select('is_open').eq('id', planId).maybeSingle()
  return data?.is_open === true
}
