import { describe, it, expect, beforeEach, vi } from 'vitest'

// 記憶體中的假資料庫：table=null 代表資料表尚未建立
const db: { table: Map<string, unknown> | null; file: string | null } = { table: null, file: null }

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: async () => db.table === null
        ? { data: null, error: { message: 'relation "system_settings" does not exist' } }
        : { data: [...db.table].map(([key, value]) => ({ key, value })), error: null },
      upsert: async (rows: { key: string; value: unknown }[]) => {
        if (db.table === null) return { error: { message: 'missing' } }
        rows.forEach(r => db.table!.set(r.key, r.value))
        return { error: null }
      },
      delete: () => ({ in: async (_c: string, keys: string[]) => { keys.forEach(k => db.table!.delete(k)); return { error: null } } }),
    }),
    storage: {
      from: () => ({
        download: async () => db.file === null ? { data: null, error: { message: 'not found' } } : { data: new Blob([db.file]), error: null },
        upload: async (_p: string, blob: Blob) => { db.file = await blob.text(); return { error: null } },
      }),
    },
  },
}))

const { readGlobalSettingsRaw, writeGlobalSettings, replaceGlobalSettingsRaw } = await import('./settings')
const fileJson = () => JSON.parse(db.file || '{}')

beforeEach(() => {
  db.table = null
  db.file = JSON.stringify({ system_name: '核銷系統', gas_url: 'https://gas', school_years: ['114', '115'] })
})

describe('全域設定：資料表尚未建立（相容舊檔）', () => {
  it('讀寫都沿用 settings.json', async () => {
    expect(await readGlobalSettingsRaw()).toMatchObject({ system_name: '核銷系統' })
    await writeGlobalSettings({ bcc_email: 'a@b.tw' })
    expect(fileJson()).toMatchObject({ system_name: '核銷系統', bcc_email: 'a@b.tw' })
  })
})

describe('全域設定：資料表已建立、尚未搬移', () => {
  beforeEach(() => { db.table = new Map() })

  it('讀取仍來自 settings.json', async () => {
    expect(await readGlobalSettingsRaw()).toMatchObject({ gas_url: 'https://gas' })
  })

  it('第一次寫入時先搬移整份舊設定，再套用變更', async () => {
    await writeGlobalSettings({ bcc_email: 'a@b.tw' })
    expect(Object.fromEntries(db.table!)).toEqual({
      system_name: '核銷系統', gas_url: 'https://gas', school_years: ['114', '115'], bcc_email: 'a@b.tw',
    })
    expect(await readGlobalSettingsRaw()).toMatchObject({ school_years: ['114', '115'], bcc_email: 'a@b.tw' })
  })
})

describe('全域設定：已改用資料表', () => {
  beforeEach(() => { db.table = new Map<string, unknown>([['system_name', '核銷系統'], ['gas_url', 'https://gas']]) })

  it('只更新有變動的設定，不動檔案', async () => {
    const before = db.file
    await writeGlobalSettings({ gas_url: 'https://new' })
    expect(db.table!.get('gas_url')).toBe('https://new')
    expect(db.table!.get('system_name')).toBe('核銷系統')
    expect(db.file).toBe(before)
  })

  it('仍會擋下分區欄位的值，只允許清空', async () => {
    await writeGlobalSettings({ admin_name: '王美惠', block1_deadline: '' })
    expect(db.table!.has('admin_name')).toBe(false)
    expect(db.table!.get('block1_deadline')).toBe('')
  })

  it('整份覆寫會移除不在新內容中的設定', async () => {
    await replaceGlobalSettingsRaw({ system_name: '新名稱' })
    expect(Object.fromEntries(db.table!)).toEqual({ system_name: '新名稱' })
  })
})
