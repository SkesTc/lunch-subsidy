import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.is_admin) redirect('/school')

  // 取得所有學校 + 各校狀態
  const { data: schools } = await supabaseAdmin
    .from('schools').select('*').order('code')
  const { data: banks } = await supabaseAdmin
    .from('bank_accounts').select('school_id, semester, confirmed_at, is_modified')
  const { data: settlements } = await supabaseAdmin
    .from('settlements').select('school_id, semester, status, scan_file_path, remittance_file_path, repay_amount, surplus')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar email={session.user.email ?? undefined} isAdmin={true} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AdminDashboardClient
          schools={schools || []}
          banks={banks || []}
          settlements={settlements || []}
        />
      </main>
    </div>
  )
}
