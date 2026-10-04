import { describe, it, expect } from 'vitest'
import { renderTemplate, resolveTemplate, NOTIFY_SCENARIOS } from './notifyTemplates'

describe('催收通知範本', () => {
  it('套用變數，未知變數原樣保留', () => {
    expect(renderTemplate('{schoolName} 應繳回 {repayAmount} 元 {typo}', { schoolName: '豐陽國中', repayAmount: '96,760' }))
      .toBe('豐陽國中 應繳回 96,760 元 {typo}')
  })

  it('每個情境的預設範本只使用已定義的變數', () => {
    const known = ['schoolName', 'contactName', 'contactTitle', 'semLabel', 'deadline', 'repayAmount', 'hostSchool', 'adminName', 'adminTitle', 'adminPhone', 'zoneName']
    for (const s of NOTIFY_SCENARIOS) {
      const used = [...`${s.defaults.subject}${s.defaults.body}`.matchAll(/\{([a-zA-Z]+)\}/g)].map(m => m[1])
      expect(used.filter(v => !known.includes(v))).toEqual([])
    }
  })

  it('情境範本：有儲存用儲存值，沒有用系統預設', () => {
    const saved = { notify_templates: JSON.stringify({ scan: { subject: '自訂主旨', body: '自訂內容' } }) }
    expect(resolveTemplate('scan', saved)).toEqual({ subject: '自訂主旨', body: '自訂內容' })
    expect(resolveTemplate('expense', saved).subject).toContain('實支金額')
  })

  it('自訂情境沿用舊的 notify_subject / notify_body', () => {
    expect(resolveTemplate('custom', { notify_subject: '舊主旨', notify_body: '舊內容' })).toEqual({ subject: '舊主旨', body: '舊內容' })
  })

  it('notify_templates 格式損壞時退回預設，不會出錯', () => {
    expect(resolveTemplate('remittance', { notify_templates: '{壞掉' }).body).toContain('{repayAmount}')
  })
})
