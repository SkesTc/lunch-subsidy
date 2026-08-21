import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateProfileCache } from '@/lib/profile-cache'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  if (session.user.school_id) return NextResponse.json({ error: '已綁定學校' }, { status: 400 })

  const { schoolCode } = await req.json()

  // 從資料庫查詢學校
  const { data: schoolRow } = await supabaseAdmin
    .from('schools').select('id').eq('code', schoolCode).single()
  if (!schoolRow) return NextResponse.json({ error: '學校不存在' }, { status: 400 })

  // 檢查此學校是否已有其他非管理員帳號綁定
  const { data: taken } = await supabaseAdmin
    .from('user_profiles')
    .select('email')
    .eq('school_id', schoolRow.id)
    .neq('email', session.user.email)
    .eq('is_admin', false)
    .limit(1)

  const takenBy = taken?.[0] ?? null
  if (takenBy) {
    return NextResponse.json({
      error: `此學校已由 ${takenBy.email} 完成綁定，如需變更請聯絡承辦學校解除原綁定後再重試。`,
      existingEmail: takenBy.email,
    }, { status: 409 })
  }

  await supabaseAdmin
    .from('user_profiles')
    .update({ school_id: schoolRow.id })
    .eq('email', session.user.email)

  invalidateProfileCache(session.user.email)
  return NextResponse.json({ ok: true })
}
