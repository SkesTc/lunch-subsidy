import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export default async function Home() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  if (session.user?.is_admin) redirect('/mode-select')

  let schoolId = session.user?.school_id ?? 0
  if (!schoolId) {
    // session 快取可能過時，直接查 DB
    const { data } = await supabaseAdmin
      .from('user_profiles').select('school_id, is_admin').eq('email', session.user.email).single()
    if (data?.is_admin) redirect('/mode-select')
    schoolId = data?.school_id ?? 0
  }
  if (!schoolId) redirect('/bind-school')
  redirect('/school')
}
