import { supabaseAdmin } from '@/lib/supabase'

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

const DEFAULTS: AllSettings = {
  system_name: '臺中市第2區免費營養午餐核銷系統',
  host_school: '',
  school_year: '115',
  active_school_year: '115',
  school_years: ['115'],
  admin_name: '',
  admin_title: '',
  admin_phone: '',
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

// 模組層級快取，TTL 60 秒
let _cache: { data: AllSettings; ts: number } | null = null
const TTL = 60_000

async function fetchSettings(): Promise<AllSettings> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(PATH)
    if (data) {
      const parsed = JSON.parse(await data.text())
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* 忽略，回傳預設值 */ }
  return { ...DEFAULTS }
}

/** 統一入口：所有設定從這裡取，60 秒快取 */
export async function getAllSettings(): Promise<AllSettings> {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.data
  const data = await fetchSettings()
  _cache = { data, ts: Date.now() }
  return data
}

/** 讓外部可以主動清除快取（儲存設定後呼叫） */
export function invalidateSettingsCache() {
  _cache = null
}

// ── 向下相容的具名 exports ──────────────────────────────────
export async function getSystemSettings() {
  return getAllSettings()
}

export async function getActiveSchoolYear(): Promise<string> {
  const s = await getAllSettings()
  return s.active_school_year || s.school_year || '115'
}

export async function getSchoolYears(): Promise<string[]> {
  const s = await getAllSettings()
  return Array.isArray(s.school_years) && s.school_years.length > 0 ? s.school_years : ['115']
}

export async function getGasSettings() {
  const s = await getAllSettings()
  return { gasUrl: s.gas_url || '', gasSecret: s.gas_secret || '', driveFolderId: s.drive_folder_id || '' }
}
