// 計畫送件狀態（純函式，前後端共用）
export type PlanStatus = 'not_open' | 'open' | 'closed'

export const PLAN_STATUSES: PlanStatus[] = ['not_open', 'open', 'closed']

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  not_open: '未開放',
  open: '已開放',
  closed: '已結案',
}

// 相容尚未執行 SQL 的舊資料：沒有 status 欄位時依 is_open 推算
export function planStatusOf(plan: { status?: string | null; is_open?: boolean | null } | null | undefined): PlanStatus {
  const s = plan?.status
  if (s === 'not_open' || s === 'open' || s === 'closed') return s
  return plan?.is_open ? 'open' : 'not_open'
}
