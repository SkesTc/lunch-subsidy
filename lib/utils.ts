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

// 中文大寫金額（例：壹拾貳萬參仟肆佰伍拾陸元）
export function toChineseAmount(n: number): string {
  if (!n || n <= 0) return ''
  const DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
  const UNITS = ['', '拾', '佰', '仟']

  function section(num: number): string {
    let s = ''
    let hasZero = false
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(num / Math.pow(10, i)) % 10
      if (d === 0) {
        hasZero = true
      } else {
        if (hasZero && s) s += '零'
        s += DIGITS[d] + UNITS[i]
        hasZero = false
      }
    }
    return s
  }

  const yi = Math.floor(n / 100000000)
  const wan = Math.floor((n % 100000000) / 10000)
  const rest = n % 10000

  let result = ''
  if (yi > 0) {
    result += section(yi) + '億'
    if (wan < 1000 && wan > 0) result += '零'
  }
  if (wan > 0) {
    result += section(wan) + '萬'
    if (rest < 1000 && rest > 0) result += '零'
  }
  if (rest > 0) result += section(rest)
  return result + '元'
}

// 輸入框千位分隔（只保留數字，加千分位）
export function parseInputAmount(raw: string): number {
  return Number(raw.replace(/[^0-9]/g, '')) || 0
}

export function formatInputDisplay(n: number): string {
  if (!n) return ''
  return n.toLocaleString('zh-TW')
}
