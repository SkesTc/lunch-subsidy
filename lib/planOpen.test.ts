import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = { planOpen: true as boolean | null, status: undefined as string | undefined, settings: {} as Record<string, string> }

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.planOpen === null ? null : { is_open: state.planOpen, status: state.status } }) }) }) }),
  },
}))
vi.mock('@/lib/settings', () => ({ getGlobalSettings: async () => state.settings }))

const { isSubmissionOpen } = await import('./planOpen')

beforeEach(() => { state.planOpen = true; state.status = undefined; state.settings = {} })

describe('是否開放送件', () => {
  it('計畫模式：依計畫開關', async () => {
    expect(await isSubmissionOpen('p1', 1)).toBe(true)
    state.planOpen = false
    expect(await isSubmissionOpen('p1', 1)).toBe(false)
  })

  it('計畫狀態為已結案或未開放時不可送件', async () => {
    state.status = 'closed'
    expect(await isSubmissionOpen('p1', 1)).toBe(false)
    state.status = 'not_open'
    expect(await isSubmissionOpen('p1', 1)).toBe(false)
    state.status = 'open'
    expect(await isSubmissionOpen('p1', 1)).toBe(true)
  })

  it('計畫不存在時視為未開放', async () => {
    state.planOpen = null
    expect(await isSubmissionOpen('不存在', 1)).toBe(false)
  })

  it('學期模式：第 1 學期看 block2_open、第 2 學期看 block3_open', async () => {
    state.settings = { block2_open: 'true', block3_open: 'false' }
    expect(await isSubmissionOpen(null, 1)).toBe(true)
    expect(await isSubmissionOpen(null, 2)).toBe(false)
    expect(await isSubmissionOpen(null, '2')).toBe(false)
  })

  it('學期模式未設定開關時預設開放（沿用原本行為）', async () => {
    expect(await isSubmissionOpen(undefined, 1)).toBe(true)
    expect(await isSubmissionOpen(undefined, 2)).toBe(true)
  })
})
