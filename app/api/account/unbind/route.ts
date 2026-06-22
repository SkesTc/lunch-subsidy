import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { invalidateProfileCache } from '@/lib/profile-cache'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  await supabaseAdmin
    .from('user_profiles')
    .update({ school_id: null })
    .eq('email', session.user.email)

  invalidateProfileCache(session.user.email)
  return NextResponse.json({ ok: true })
}
