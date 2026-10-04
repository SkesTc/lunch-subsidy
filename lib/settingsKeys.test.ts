import { describe, it, expect } from 'vitest'
import { filterGlobalUpdates, stripZoneKeys } from './settingsKeys'

describe('全域／分區設定欄位歸屬', () => {
  it('寫入全域設定時擋下分區欄位的值，避免分區資料滲入全域檔', () => {
    expect(filterGlobalUpdates({ admin_name: '王美惠', host_school: '社口國小', gas_url: 'https://x' }))
      .toEqual({ gas_url: 'https://x' })
  })

  it('分區欄位允許清空（空字串）', () => {
    expect(filterGlobalUpdates({ block1_deadline: '', designer_name: '林' }))
      .toEqual({ block1_deadline: '', designer_name: '林' })
  })

  it('讀取全域設定時去除殘留的分區欄位', () => {
    expect(stripZoneKeys({ system_name: 'A', admin_phone: '04', block1_open: 'true', bcc_email: 'a@b' }))
      .toEqual({ system_name: 'A', bcc_email: 'a@b' })
  })
})
