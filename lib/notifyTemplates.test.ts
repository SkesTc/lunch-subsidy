import { describe, it, expect } from 'vitest'
import {
  renderTemplate, listCollectionTemplates, getCustomTemplates, updateCollectionTemplate, findCollectionTemplate,
  BUILTIN_TEMPLATES, GENERAL_TEMPLATE_DEFAULT, REVIEW_DEFAULTS, NOTIFY_VARIABLES, REVIEW_VARIABLES,
} from './notifyTemplates'

const varsOf = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(m => `{${m[1]}}`)

describe('催收通知範本', () => {
  it('套用變數，未知變數原樣保留', () => {
    expect(renderTemplate('{schoolName} 應繳回 {repayAmount} 元 {typo}', { schoolName: '豐陽國中', repayAmount: '96,760' }))
      .toBe('豐陽國中 應繳回 96,760 元 {typo}')
  })

  it('預設範本只使用該類通知已定義的變數', () => {
    const notifyVars = NOTIFY_VARIABLES.map(v => v[0])
    for (const t of [...BUILTIN_TEMPLATES.map(b => b.defaults), GENERAL_TEMPLATE_DEFAULT]) {
      expect(varsOf(t.subject + t.body).filter(v => !notifyVars.includes(v))).toEqual([])
    }
    const reviewVars = REVIEW_VARIABLES.map(v => v[0])
    for (const t of Object.values(REVIEW_DEFAULTS)) {
      expect(varsOf(t.subject + t.body).filter(v => !reviewVars.includes(v))).toEqual([])
    }
  })

  it('內建範本：有儲存用儲存值，沒有用系統預設', () => {
    const s = { notify_templates: JSON.stringify({ scan: { subject: '自訂主旨', body: '自訂內容' } }) }
    expect(findCollectionTemplate(s, 'scan')).toMatchObject({ subject: '自訂主旨', body: '自訂內容', builtIn: true, target: 'scan' })
    expect(findCollectionTemplate(s, 'expense')!.subject).toContain('實支金額')
  })

  it('尚未建立自訂清單時，舊版單一自訂範本成為「一般提醒」', () => {
    const list = getCustomTemplates({ notify_subject: '舊主旨', notify_body: '舊內容' })
    expect(list).toEqual([{ id: 'general', label: '一般提醒', target: 'all', subject: '舊主旨', body: '舊內容' }])
    expect(listCollectionTemplates({}).map(t => t.key)).toEqual(['expense', 'scan', 'remittance', 'custom:general'])
  })

  it('可有多個自訂範本，各自設定適用對象', () => {
    const s = { notify_custom_templates: JSON.stringify([
      { id: 'a', label: '一般提醒', target: 'all', subject: 'A', body: 'A' },
      { id: 'b', label: '結算表最後提醒', target: 'scan', subject: 'B', body: 'B' },
    ]) }
    const customs = listCollectionTemplates(s).filter(t => !t.builtIn)
    expect(customs.map(t => [t.key, t.target])).toEqual([['custom:a', 'all'], ['custom:b', 'scan']])
  })

  it('更新範本只改動對應的那一個', () => {
    const s = { notify_custom_templates: JSON.stringify([
      { id: 'a', label: 'A', target: 'all', subject: 'A', body: 'A' },
      { id: 'b', label: 'B', target: 'scan', subject: 'B', body: 'B' },
    ]) }
    const patch = updateCollectionTemplate(s, 'custom:b', { subject: '新B', target: 'remittance' })
    const list = JSON.parse(patch.notify_custom_templates)
    expect(list[0]).toMatchObject({ id: 'a', subject: 'A' })
    expect(list[1]).toMatchObject({ id: 'b', subject: '新B', body: 'B', target: 'remittance' })

    const builtIn = updateCollectionTemplate({}, 'remittance', { body: '新內容' })
    expect(JSON.parse(builtIn.notify_templates).remittance.body).toBe('新內容')
  })

  it('設定格式損壞時退回預設，不會出錯', () => {
    expect(findCollectionTemplate({ notify_templates: '{壞掉', notify_custom_templates: '[壞' }, 'remittance')!.body).toContain('{repayAmount}')
    expect(getCustomTemplates({ notify_custom_templates: '[壞' })[0].id).toBe('general')
  })
})
