import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ModeSelectClient from './ModeSelectClient'

export default async function ModeSelectPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.user.is_admin) redirect('/school')

  return (
    <ModeSelectClient
      hasSchool={!!session.user.school_id}
      email={session.user.email ?? ''}
    />
  )
}
