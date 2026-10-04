import { supabaseAdmin } from '@/lib/supabase'
import { getZoneSettings } from '@/lib/zones'

const BUCKET = 'settlement-files'
const PATH = '__system/settings.json'

export interface AllSettings {
  system_name: string
  host_school: string
  school_year: string
  active_school_year: string
  school_years: string[]
  admin_name: string
  admin_title: string
  admin_phone: string
  designer_name: string
  designer_title: string
  bcc_email: string
  bcc_enabled: string
  plan_name: string
  manual_url: string
  drive_folder_id: string
  gas_url: string
  gas_secret: string
  notify_subject: string
  notify_body: string
  review_approve_subject: string
  review_approve_body: string
  review_reject_subject: string
  review_reject_body: string
  block1_open: string
  block1_deadline: string
  block2_open: string
  block2_deadline: string
  block3_open: string
  block3_deadline: string
  [key: string]: string | string[]
}

export const DEFAULTS: AllSettings = {
  system_name: '臺中市第2區免費營養午餐核銷系統',
  host_school: '',
  school_year: '115',
  active_school_year: '115',
  school_years: ['115'],
  admin_name: '',
  admin_title: '',
  admin_phone: '',
  designer_name: '',
  designer_title: '',
  bcc_email: '',
  bcc_enabled: 'true',
  plan_name: '',
  manual_url: '',
  drive_folder_id: '',
  gas_url: '',
  gas_secret: '',
  notify_subject: '【核銷系統】請儘速完成資料上傳',
  notify_body: '{schoolName} 您好，\n\n提醒您尚有核銷資料尚未完成上傳，請儘速登入系統完成作業。\n\n如有問題請聯絡承辦人員：{adminName}　{adminPhone}\n\n臺中市政府教育局',
  review_approve_subject: '【核銷系統】{semLabel}申請已核准',
  review_approve_body: '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請已核准通過。\n\n{actionNote}\n\n{adminNote}臺中市第2區免費營養午餐核銷系統',
  review_reject_subject: '【核銷系統】{semLabel}申請未通過',
  review_reject_body: '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請未通過審核。\n\n{adminNote}如有疑問請聯絡承辦人員。\n\n臺中市第2區免費營養午餐核銷系統',
  block1_open: 'true',
  block1_deadline: '115學年度開學後',
  block2_open: 'true',
  block2_deadline: '2026-02-15',
  block3_open: 'false',
  block3_deadline: '2026-06-30',
}

// 模組層級快取，TTL 8 秒（依 zoneId 分開快取；全域設定使用 GLOBAL_CACHE_KEY）
const _cacheMap = new Map<number, { data: AllSettings; ts: number }>()
const TTL = 8_000
const GLOBAL_CACHE_KEY = -1

function stripZoneKeys(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !isZoneKey(k)))
}

async function fetchSettings(zoneId: number): Promise<AllSettings> {
  try {
    // 讀取 zone 基本資訊（host_school 存在 zones 表）
    const { data: zoneRow } = await supabaseAdmin
      .from('zones')
      .select('name, host_school, host_email')
      .eq('id', zoneId)
      .single()
    const zoneBasic = zoneRow
      ? { host_school: zoneRow.host_school || '', system_name: zoneRow.name || '' }
      : {}

    // 從 zone_settings 讀取（新架構）
    const zoneSettingsData = await getZoneSettings(zoneId)
    const hasZoneSettings = Object.keys(zoneSettingsData).length > 0

    // 全域設定（去除分區欄位：分區欄位留空時用預設值，不回退到全域檔）
    const jsonSettings = stripZoneKeys(await readGlobalSettingsRaw()) as Partial<AllSettings>

    if (hasZoneSettings || zoneRow) {
      const filtered = Object.fromEntries(
        Object.entries(zoneSettingsData).filter(([, v]) => v !== undefined && v !== '')
      )
      return { ...DEFAULTS, ...jsonSettings, ...zoneBasic, ...filtered } as AllSettings
    }

    // Fallback：從 settings.json 讀取（舊架構向下相容）
    if (Object.keys(jsonSettings).length > 0) {
      return { ...DEFAULTS, ...jsonSettings } as AllSettings
    }
  } catch { /* 忽略，回傳預設值 */ }
  return { ...DEFAULTS }
}

async function fetchSettingsForZone(zoneId: number): Promise<AllSettings> {
  return fetchSettings(zoneId)
}

/** 全域設定（不含任何分區值）：學年度、GAS、範本、備份等全系統共用欄位 */
export async function getGlobalSettings(): Promise<AllSettings> {
  const cached = _cacheMap.get(GLOBAL_CACHE_KEY)
  if (cached && Date.now() - cached.ts < TTL) return cached.data
  const data = { ...DEFAULTS, ...stripZoneKeys(await readGlobalSettingsRaw()) } as AllSettings
  _cacheMap.set(GLOBAL_CACHE_KEY, { data, ts: Date.now() })
  return data
}

/** 指定分區的完整設定（全域設定 + 該分區欄位），快取 */
export async function getAllSettings(zoneId: number): Promise<AllSettings> {
  const cached = _cacheMap.get(zoneId)
  if (cached && Date.now() - cached.ts < TTL) return cached.data
  const data = await fetchSettings(zoneId)
  _cacheMap.set(zoneId, { data, ts: Date.now() })
  return data
}

/** 依區別取設定（不走快取，供後台管理使用） */
export async function getSettingsForZone(zoneId: number): Promise<AllSettings> {
  return fetchSettingsForZone(zoneId)
}

/** 全域系統名稱（不受分區覆蓋影響） */
export async function getGlobalSystemName(): Promise<string> {
  return String((await getGlobalSettings()).system_name || DEFAULTS.system_name)
}

// 分區專屬欄位：由「區別管理」維護（zones 表 / zone_settings），不屬於全域設定檔
export const ZONE_KEYS = ['host_school', 'admin_name', 'admin_title', 'admin_phone', 'block1_open', 'block1_deadline'] as const
const isZoneKey = (k: string) => (ZONE_KEYS as readonly string[]).includes(k)

/** 讀取全域設定檔原始內容（不疊加預設值與分區設定） */
export async function readGlobalSettingsRaw(): Promise<Record<string, unknown>> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(PATH)
    if (data) return JSON.parse(await data.text())
  } catch { /* 尚無設定檔 */ }
  return {}
}

/**
 * 全域設定唯一寫入口：只合併到全域設定檔原始內容，不會把分區合併後的值寫回。
 * 分區欄位只允許清空（寫入空字串），避免分區值滲入全域檔後在其他分區留空時「冒出來」。
 */
export async function writeGlobalSettings(updates: Record<string, unknown>) {
  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([k, v]) => !isZoneKey(k) || v === '')
  )
  const raw = await readGlobalSettingsRaw()
  const blob = new Blob([JSON.stringify({ ...raw, ...filtered }, null, 2)], { type: 'application/json' })
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(PATH, blob, { upsert: true, contentType: 'application/json' })
  if (error) throw new Error(error.message)
  _cacheMap.clear()
}

/** 整份覆寫全域設定檔（僅供資料清理工具使用；一般儲存請用 writeGlobalSettings） */
export async function replaceGlobalSettingsRaw(obj: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(PATH, blob, { upsert: true, contentType: 'application/json' })
  if (error) throw new Error(error.message)
  _cacheMap.clear()
}

/** 讓外部可以主動清除快取（儲存設定後呼叫） */
export function invalidateSettingsCache() {
  _cacheMap.clear()
}

// ── 向下相容的具名 exports ──────────────────────────────────
export async function getSystemSettings() {
  return getGlobalSettings()
}

export async function getActiveSchoolYear(): Promise<string> {
  const s = await getGlobalSettings()
  return s.active_school_year || s.school_year || '115'
}

export async function getSchoolYears(): Promise<string[]> {
  const s = await getGlobalSettings()
  return Array.isArray(s.school_years) && s.school_years.length > 0 ? s.school_years : ['115']
}

export async function getGasSettings() {
  const s = await getGlobalSettings()
  return { gasUrl: s.gas_url || '', gasSecret: s.gas_secret || '', driveFolderId: s.drive_folder_id || '' }
}
