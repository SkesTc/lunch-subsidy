import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { SCHOOLS_DATA } from '@/lib/schools-data'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  if (session.user.school_id) return NextResponse.json({ error: '已綁定學校' }, { status: 400 })

  const { schoolCode } = await req.json()
  const school = SCHOOLS_DATA.find(s => s.code === schoolCode)
  if (!school) return NextResponse.json({ error: '學校不存在' }, { status: 400 })

  // 取得 school id
  const { data: schoolRow } = await supabaseAdmin
    .from('schools').select('id').eq('code', schoolCode).single()
  if (!schoolRow) return NextResponse.json({ error: '資料庫查無此校' }, { status: 400 })

  await supabaseAdmin
    .from('user_profiles')
    .update({ school_id: schoolRow.id })
    .eq('email', session.user.email)

  return NextResponse.json({ ok: true })
}
