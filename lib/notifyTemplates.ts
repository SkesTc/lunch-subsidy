// 通知信範本（純函式，前後端共用）

// 催收對象條件：決定哪些學校「需要」被催收
export type NotifyCondition = 'all' | 'expense' | 'scan' | 'remittance'

export const CONDITION_LABELS: Record<NotifyCondition, string> = {
  all: '所有勾選的學校',
  expense: '尚未填報實支金額的學校',
  scan: '尚未上傳經費收支結算表的學校',
  remittance: '有應繳回賸餘款、尚未上傳送款憑單的學校',
}

export interface NotifyTemplate { subject: string; body: string }

// 催收範本：內建（可改內容、不可刪）＋自訂（可新增多個）
export interface CollectionTemplate extends NotifyTemplate {
  key: string                // 內建：expense / scan / remittance；自訂：custom:<id>
  label: string
  target: NotifyCondition
  builtIn: boolean
}

export interface CustomTemplate extends NotifyTemplate { id: string; label: string; target: NotifyCondition }

const FOOTER = '如有疑問，請聯絡{hostSchool} {adminName}{adminTitle}，電話：{adminPhone}。'

export const BUILTIN_TEMPLATES: { key: 'expense' | 'scan' | 'remittance'; label: string; defaults: NotifyTemplate }[] = [
  {
    key: 'expense',
    label: '實支金額未填報',
    defaults: {
      subject: '【核銷系統】請填報{semLabel}實支金額',
      body: `{schoolName} {contactName}{contactTitle} 您好：

貴校{semLabel}尚未於核銷系統填報實支金額。
請於{deadline}前登入系統填寫實支金額，下載經費收支結算表，列印並逐級核章後上傳掃描檔。

${FOOTER}`,
    },
  },
  {
    key: 'scan',
    label: '結算表未上傳',
    defaults: {
      subject: '【核銷系統】請上傳{semLabel}經費收支結算表',
      body: `{schoolName} {contactName}{contactTitle} 您好：

貴校{semLabel}尚未上傳經費收支結算表掃描檔。
請將已列印並逐級核章的經費收支結算表掃描成 PDF、JPG 或 PNG 檔，於{deadline}前登入系統上傳。

${FOOTER}`,
    },
  },
  {
    key: 'remittance',
    label: '送款憑單未上傳',
    defaults: {
      subject: '【核銷系統】請繳回{semLabel}賸餘款並上傳送款憑單',
      body: `{schoolName} {contactName}{contactTitle} 您好：

依貴校填報的實支金額，{semLabel}應繳回賸餘款新臺幣 {repayAmount} 元，目前尚未上傳送款憑單。
請完成繳回公庫後，於{deadline}前登入系統上傳送款憑單掃描檔，並填寫繳款日期。

${FOOTER}`,
    },
  },
]

export const GENERAL_TEMPLATE_DEFAULT: NotifyTemplate = {
  subject: '【核銷系統】請儘速完成資料上傳',
  body: `{schoolName} {contactName}{contactTitle} 您好：

提醒您尚有核銷資料尚未完成，請儘速登入系統完成作業。

${FOOTER}`,
}

// 審核結果通知的系統預設內容（設定為空時使用）
export const REVIEW_DEFAULTS: Record<'approve' | 'reject', NotifyTemplate> = {
  approve: {
    subject: '【核銷系統】{semLabel}申請已核准',
    body: '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請已核准通過。\n\n{actionNote}\n\n{adminNote}臺中市第2區免費營養午餐核銷系統',
  },
  reject: {
    subject: '【核銷系統】{semLabel}申請未通過',
    body: '{contactName} 您好，\n\n您提出的{semLabel}「{typeLabel}」申請未通過審核。\n\n{adminNote}如有疑問請聯絡承辦人員。\n\n臺中市第2區免費營養午餐核銷系統',
  },
}

// 催收通知可用的變數
export const NOTIFY_VARIABLES: [string, string, string][] = [
  ['{schoolName}', '學校名稱', '社口國民小學'],
  ['{contactName}', '學校聯絡人姓名（未填時為「承辦人」）', '王小明'],
  ['{contactTitle}', '學校聯絡人職稱', '組長'],
  ['{semLabel}', '計畫／學期', '115學年度第1學期'],
  ['{deadline}', '截止日期（未設定時為「規定期限」）', '2026-06-30'],
  ['{repayAmount}', '該校應繳回金額', '96,760'],
  ['{hostSchool}', '承辦學校（該校所屬分區）', '社口國民小學'],
  ['{adminName}', '承辦人姓名（該校所屬分區）', '王美惠'],
  ['{adminTitle}', '承辦人職稱（該校所屬分區）', '總務主任'],
  ['{adminPhone}', '承辦人電話（該校所屬分區）', '04-25626834#730'],
  ['{zoneName}', '分區名稱', '臺中市第2區'],
]

// 審核結果通知可用的變數
export const REVIEW_VARIABLES: [string, string, string][] = [
  ['{schoolName}', '學校名稱', '社口國民小學'],
  ['{contactName}', '學校聯絡人姓名', '王小明'],
  ['{contactTitle}', '學校聯絡人職稱', '組長'],
  ['{semLabel}', '計畫與學期', '開學加碼（第1學期）'],
  ['{planLabel}', '計畫短標籤', '開學加碼'],
  ['{planName}', '計畫完整名稱', '115學年度開學加碼計畫'],
  ['{typeLabel}', '申請類型', '經費收支結算表掃描檔上傳'],
  ['{actionNote}', '核准後操作說明（自動產生）', '新上傳的檔案已生效'],
  ['{adminNote}', '審核備註／退回原因（含換行）', '退回原因：缺少核章'],
  ['{hostSchool}', '承辦學校', '社口國民小學'],
  ['{adminName}', '承辦人姓名', '王美惠'],
  ['{adminTitle}', '承辦人職稱', '總務主任'],
  ['{adminPhone}', '承辦人電話', '04-25626834#730'],
  ['{zoneName}', '分區名稱', '臺中市第2區'],
]

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' ? v as T : fallback
  } catch {
    return fallback
  }
}

export function parseSavedTemplates(raw: unknown): Partial<Record<string, NotifyTemplate>> {
  return parseJson(raw, {})
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

// 自訂範本清單：尚未建立清單時，把舊版單一「自訂」範本（notify_subject / notify_body）當作第一個
export function getCustomTemplates(settings: Record<string, unknown>): CustomTemplate[] {
  const list = parseJson<CustomTemplate[] | null>(settings.notify_custom_templates, null)
  if (Array.isArray(list)) return list.filter(t => t && t.id)
  return [{
    id: 'general',
    label: '一般提醒',
    target: 'all',
    subject: str(settings.notify_subject) || GENERAL_TEMPLATE_DEFAULT.subject,
    body: str(settings.notify_body) || GENERAL_TEMPLATE_DEFAULT.body,
  }]
}

// 全部催收範本（內建在前、自訂在後）
export function listCollectionTemplates(settings: Record<string, unknown>): CollectionTemplate[] {
  const saved = parseSavedTemplates(settings.notify_templates)
  const builtIns: CollectionTemplate[] = BUILTIN_TEMPLATES.map(b => ({
    key: b.key, label: b.label, target: b.key, builtIn: true,
    subject: saved[b.key]?.subject || b.defaults.subject,
    body: saved[b.key]?.body || b.defaults.body,
  }))
  const customs: CollectionTemplate[] = getCustomTemplates(settings).map(c => ({
    key: `custom:${c.id}`, label: c.label || '未命名範本', target: c.target || 'all', builtIn: false, subject: c.subject, body: c.body,
  }))
  return [...builtIns, ...customs]
}

export function findCollectionTemplate(settings: Record<string, unknown>, key: string): CollectionTemplate | undefined {
  return listCollectionTemplates(settings).find(t => t.key === key)
}

// 將某個催收範本的內容寫回設定（回傳要儲存的設定差異）
export function updateCollectionTemplate(settings: Record<string, unknown>, key: string, patch: Partial<CustomTemplate>): Record<string, string> {
  if (!key.startsWith('custom:')) {
    const saved = parseSavedTemplates(settings.notify_templates)
    const current = findCollectionTemplate(settings, key)
    if (!current) return {}
    return { notify_templates: JSON.stringify({ ...saved, [key]: { subject: patch.subject ?? current.subject, body: patch.body ?? current.body } }) }
  }
  const id = key.slice('custom:'.length)
  const list = getCustomTemplates(settings).map(c => (c.id === id ? { ...c, ...patch, id } : c))
  return { notify_custom_templates: JSON.stringify(list) }
}

// 套用變數；未知的 {變數} 原樣保留，方便看出打錯字
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (m, key: string) => (key in vars ? vars[key] : m))
}
