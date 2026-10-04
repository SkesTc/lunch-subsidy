import { describe, it, expect } from 'vitest'
import { calcRatio, calcSurplus, calcRepay, toChineseAmount, parseInputAmount } from './utils'

describe('經費收支結算計算', () => {
  it('補助比率 C = B/A，取至小數第 4 位（即百分比 2 位）', () => {
    expect(calcRatio(100, 100)).toBe(1)
    expect(calcRatio(1, 3)).toBe(0.3333)
    expect(calcRatio(2, 3)).toBe(0.6667)
    expect(calcRatio(50, 0)).toBe(0)
  })

  it('結餘款 E = A - D', () => {
    expect(calcSurplus(3596760, 3500000)).toBe(96760)
    expect(calcSurplus(1000, 1000)).toBe(0)
  })

  it('應繳回金額 F = E × C 無條件進位', () => {
    expect(calcRepay(96760, 1)).toBe(96760)
    expect(calcRepay(1000, 0.3333)).toBe(334)   // 333.3 → 334
    expect(calcRepay(0, 0.5)).toBe(0)
  })

  it('應繳回金額不受浮點誤差影響而多收 1 元', () => {
    // 100 × 0.07 在 JS 會得到 7.000000000000001，直接進位會變成 8
    expect(calcRepay(100, 0.07)).toBe(7)
    expect(calcRepay(300, 0.0333)).toBe(10)     // 9.99 → 10
    expect(calcRepay(10000, 0.1234)).toBe(1234)
    expect(calcRepay(56880, 0.15)).toBe(8532)
  })
})

describe('中文大寫金額', () => {
  it.each([
    [1, '壹元'],
    [10, '壹拾元'],
    [105, '壹佰零伍元'],
    [10010, '壹萬零壹拾元'],
    [105000, '壹拾萬伍仟元'],
    [1050000, '壹佰零伍萬元'],
    [3596760, '參佰伍拾玖萬陸仟柒佰陸拾元'],
    [10000500, '壹仟萬零伍佰元'],
    [100000000, '壹億元'],
    [100005000, '壹億零伍仟元'],
    [650000000, '陸億伍仟萬元'],
  ])('%i → %s', (n, expected) => {
    expect(toChineseAmount(n)).toBe(expected)
  })

  it('0 或負數回傳空字串', () => {
    expect(toChineseAmount(0)).toBe('')
    expect(toChineseAmount(-5)).toBe('')
  })
})

describe('輸入框金額解析', () => {
  it('去除千分位與非數字', () => {
    expect(parseInputAmount('3,596,760')).toBe(3596760)
    expect(parseInputAmount('NT$ 1,000')).toBe(1000)
    expect(parseInputAmount('')).toBe(0)
  })
})
