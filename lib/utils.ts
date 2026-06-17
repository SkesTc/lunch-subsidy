// 金額格式化（加千分位）
export function formatAmount(n: number): string {
  return n.toLocaleString('zh-TW')
}

// 補助比率計算（取至小數點2位）
export function calcRatio(b: number, a: number): number {
  if (a === 0) return 0
  return Math.round((b / a) * 10000) / 10000
}

// 結餘款計算
export function calcSurplus(a: number, d: number): number {
  return a - d
}

// 應繳回金額（無條件進位）
export function calcRepay(e: number, c: number): number {
  return Math.ceil(e * c)
}

// 7碼金融機構代碼驗證
export function validateBankCode(code: string): boolean {
  return /^\d{7}$/.test(code)
}

// 學期標籤
export function semLabel(sem: 1 | 2): string {
  return `115學年度第${sem}學期`
}
