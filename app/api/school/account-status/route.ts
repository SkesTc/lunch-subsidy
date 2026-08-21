import { auth } from '@/lib/auth'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { supabaseAdmin } from '@/lib/supabase'
import { getAllSettings } from '@/lib/settings'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

/**
 * 合併帳戶確認頁需要的兩個 API 呼叫為一個：
 * /api/account?semester=1 + /api/account/change-request
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 401 })

  const settings = await getAllSettings()
  const schoolYear = (settings.active_school_year || settings.school_year || '115') as string

  // 一次 auth + 一次 schoolYear → 兩個查詢並行
  const [{ data: bankAccount }, pendingRequest] = await Promise.all([
    supabaseAdmin
      .from('bank_accounts')
      .select('id, school_id, semester, bank_name, branch_name, bank_code, account_name, account_number, confirmed_at, is_modified, is_preloaded')
      .eq('school_id', schoolId)
      .eq('semester', 1)
      .eq('school_year', schoolYear)
      .single(),
    (async () => {
      try {
        const path = `__account-changes/${schoolId}_${schoolYear}.json`
        const { data } = await supabaseAdmin.storage.from(BUCKET).download(path)
        if (data) return JSON.parse(await data.text())
      } catch { /* no request yet */ }
      return null
    })(),
  ])

  return NextResponse.json({
    bankAccount: bankAccount || null,
    pendingRequest,
  })
}
