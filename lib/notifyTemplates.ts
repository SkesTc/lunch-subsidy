// 催收通知情境與範本（純函式，前後端共用）

export type NotifyScenarioId = 'expense' | 'scan' | 'remittance' | 'custom'

export interface NotifyTemplate { subject: string; body: string }

export interface NotifyScenario {
  id: NotifyScenarioId
  label: string
  target: string          // 適用對象說明
  defaults: NotifyTemplate
}

const FOOTER = '如有疑問，請聯絡{hostSchool} {adminName}{adminTitle}，電話：{adminPhone}。'

export const NOTIFY_SCENARIOS: NotifyScenario[] = [
  {
    id: 'expense',
    label: '實支金額未填報',
    target: '尚未填報實支金額的學校',
    defaults: {
      subject: '【核銷系統】請填報{semLabel}實支金額',
      body: `{schoolName} {contactName}{contactTitle} 您好：

貴校{semLabel}尚未於核銷系統填報實支金額。
請於{deadline}前登入系統填寫實支金額，下載經費收支結算表，列印並逐級核章後上傳掃描檔。

${FOOTER}`,
    },
  },
  {
    id: 'scan',
    label: '結算表未上傳',
    target: '尚未上傳經費收支結算表掃描檔的學校',
    defaults: {
      subject: '【核銷系統】請上傳{semLabel}經費收支結算表',
      body: `{schoolName} {contactName}{contactTitle} 您好：

貴校{semLabel}尚未上傳經費收支結算表掃描檔。
請將已列印並逐級核章的經費收支結算表掃描成 PDF、JPG 或 PNG 檔，於{deadline}前登入系統上傳。

${FOOTER}`,
    },
  },
  {
    id: 'remittance',
    label: '送款憑單未上傳',
    target: '有應繳回賸餘款、尚未上傳送款憑單的學校',
    defaults: {
      subject: '【核銷系統】請繳回{semLabel}賸餘款並上傳送款憑單',
      body: `{schoolName} {contactName}{contactTitle} 您好：

依貴校填報的實支金額，{semLabel}應繳回賸餘款新臺幣 {repayAmount} 元，目前尚未上傳送款憑單。
請完成繳回公庫後，於{deadline}前登入系統上傳送款憑單掃描檔，並填寫繳款日期。

${FOOTER}`,
    },
  },
  {
    id: 'custom',
    label: '自訂',
    target: '所有勾選的學校',
    defaults: {
      subject: '【核銷系統】請儘速完成資料上傳',
      body: `{schoolName} {contactName}{contactTitle} 您好：

提醒您尚有核銷資料尚未完成，請儘速登入系統完成作業。

${FOOTER}`,
    },
  },
]

// 催收通知可用的變數（供範本設定頁與催收視窗顯示）
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

export function getScenario(id: NotifyScenarioId): NotifyScenario {
  return NOTIFY_SCENARIOS.find(s => s.id === id) || NOTIFY_SCENARIOS[NOTIFY_SCENARIOS.length - 1]
}

// 讀取已儲存的範本：情境範本存在 notify_templates（JSON），自訂沿用 notify_subject / notify_body
export function resolveTemplate(id: NotifyScenarioId, settings: Record<string, unknown>): NotifyTemplate {
  const defaults = getScenario(id).defaults
  if (id === 'custom') {
    return {
      subject: typeof settings.notify_subject === 'string' && settings.notify_subject ? settings.notify_subject : defaults.subject,
      body: typeof settings.notify_body === 'string' && settings.notify_body ? settings.notify_body : defaults.body,
    }
  }
  const saved = parseSavedTemplates(settings.notify_templates)[id]
  return { subject: saved?.subject || defaults.subject, body: saved?.body || defaults.body }
}

export function parseSavedTemplates(raw: unknown): Partial<Record<NotifyScenarioId, NotifyTemplate>> {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// 套用變數；未知的 {變數} 原樣保留，方便看出打錯字
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (m, key: string) => (key in vars ? vars[key] : m))
}
