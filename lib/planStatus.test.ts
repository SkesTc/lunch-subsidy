import { describe, it, expect } from 'vitest'
import { planStatusOf } from './planStatus'

describe('計畫送件狀態', () => {
  it('有 status 欄位時以它為準', () => {
    expect(planStatusOf({ status: 'closed', is_open: true })).toBe('closed')
    expect(planStatusOf({ status: 'open', is_open: false })).toBe('open')
  })
  it('尚未執行 SQL（無 status）時依 is_open 推算', () => {
    expect(planStatusOf({ is_open: true })).toBe('open')
    expect(planStatusOf({ is_open: false })).toBe('not_open')
    expect(planStatusOf({ status: null })).toBe('not_open')
  })
  it('無效或缺漏的資料視為未開放', () => {
    expect(planStatusOf({ status: '亂填' })).toBe('not_open')
    expect(planStatusOf(null)).toBe('not_open')
  })
})
