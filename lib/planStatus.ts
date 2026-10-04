// 計畫送件狀態（純函式，前後端共用）
export type PlanStatus = 'not_open' | 'open' | 'closed'

export const PLAN_STATUSES: PlanStatus[] = ['not_open', 'open', 'closed']

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  not_open: '未開放',
  open: '已開放',
  closed: '已結案',
}

export const isPlanStatus = (v: unknown): v is PlanStatus => v === 'not_open' || v === 'open' || v === 'closed'

type PlanLike = {
  status?: string | null
  is_open?: boolean | null
  semester?: number | null
  semester_status?: Record<string, string> | null
} | null | undefined

// 送件狀態：全年計畫可依學期分開設定（semester_status），未設定時沿用計畫層級狀態；
// 相容尚未執行 SQL 的舊資料：沒有 status 欄位時依 is_open 推算
export function planStatusOf(plan: PlanLike, semester?: number | null): PlanStatus {
  if (plan && plan.semester == null && semester != null) {
    const s = plan.semester_status?.[String(semester)]
    if (isPlanStatus(s)) return s
  }
  const s = plan?.status
  if (isPlanStatus(s)) return s
  return plan?.is_open ? 'open' : 'not_open'
}

// 兩學期的綜合狀態：任一學期已開放 → 已開放；全部已結案 → 已結案；其餘 → 未開放
export function aggregateStatus(statuses: PlanStatus[]): PlanStatus {
  if (statuses.includes('open')) return 'open'
  if (statuses.length > 0 && statuses.every(s => s === 'closed')) return 'closed'
  return 'not_open'
}

// 全年計畫的各學期狀態（單學期計畫回傳 null）
export function semesterStatusesOf(plan: PlanLike): Record<'1' | '2', PlanStatus> | null {
  if (!plan || plan.semester != null) return null
  return { '1': planStatusOf(plan, 1), '2': planStatusOf(plan, 2) }
}
