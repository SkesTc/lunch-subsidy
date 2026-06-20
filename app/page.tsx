import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!session.user?.school_id && !session.user?.is_admin) redirect('/bind-school')
  if (session.user?.is_admin) redirect('/mode-select')
  redirect('/school')
}
