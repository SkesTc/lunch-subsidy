import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'

export default async function BindSchoolLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  // 已綁定學校（以 DB 為準）則直接進入前台
  let schoolId = session.user?.school_id ?? 0
  if (!schoolId) {
    const { data } = await supabaseAdmin
      .from('user_profiles').select('school_id').eq('email', session.user.email).single()
    schoolId = data?.school_id ?? 0
  }
  if (schoolId) redirect('/school')

  return <>{children}</>
}
