import { describe, it, expect } from 'vitest'
import { planStatusOf, aggregateStatus, semesterStatusesOf } from './planStatus'

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

describe('全年計畫各學期狀態', () => {
  const fullYear = { semester: null, status: 'open', semester_status: { '1': 'closed', '2': 'open' } }

  it('依學期取各自狀態', () => {
    expect(planStatusOf(fullYear, 1)).toBe('closed')
    expect(planStatusOf(fullYear, 2)).toBe('open')
  })
  it('該學期未設定時沿用計畫層級狀態', () => {
    expect(planStatusOf({ semester: null, status: 'not_open', semester_status: { '1': 'open' } }, 2)).toBe('not_open')
    expect(planStatusOf({ semester: null, status: 'open' }, 1)).toBe('open')
  })
  it('單學期計畫忽略 semester_status', () => {
    expect(planStatusOf({ semester: 1, status: 'open', semester_status: { '1': 'closed' } }, 1)).toBe('open')
  })
  it('綜合狀態：任一開放即開放，全部結案才結案', () => {
    expect(aggregateStatus(['closed', 'open'])).toBe('open')
    expect(aggregateStatus(['closed', 'closed'])).toBe('closed')
    expect(aggregateStatus(['closed', 'not_open'])).toBe('not_open')
  })
  it('只有全年計畫才有各學期狀態', () => {
    expect(semesterStatusesOf(fullYear)).toEqual({ '1': 'closed', '2': 'open' })
    expect(semesterStatusesOf({ semester: 2, status: 'open' })).toBeNull()
  })
})
