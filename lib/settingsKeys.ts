// 設定欄位歸屬（純函式，不依賴資料庫，方便測試）

// 分區專屬欄位：由「區別管理」維護（zones 表 / zone_settings），不屬於全域設定檔
export const ZONE_KEYS = ['host_school', 'admin_name', 'admin_title', 'admin_phone', 'block1_open', 'block1_deadline'] as const

export const isZoneKey = (k: string) => (ZONE_KEYS as readonly string[]).includes(k)

export function stripZoneKeys<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !isZoneKey(k))) as Partial<T>
}

// 寫入全域設定時允許的更新：分區欄位只允許清空（空字串），其餘照收
export function filterGlobalUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(updates).filter(([k, v]) => !isZoneKey(k) || v === ''))
}
