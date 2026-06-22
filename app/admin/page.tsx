import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getSystemSettings } from '@/lib/settings'
import Navbar from '@/components/Navbar'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.is_admin) redirect('/school')

  const [activeSchoolYear, settings] = await Promise.all([
    getActiveSchoolYear(), getSystemSettings(),
  ])

  const { data: schools } = await supabaseAdmin
    .from('schools').select('id, code, district, name').eq('is_active', true).order('code')
  const { data: profilesData } = await supabaseAdmin
    .from('user_profiles')
    .select('email, school_id, is_admin, contact_name, contact_title, contact_phone')
    .eq('is_admin', false)

  const profiles = profilesData || []
  const contacts: Record<string, { contact_name: string; contact_title: string; contact_phone: string }> = {}
  for (const p of profiles) {
    if (p.email) {
      contacts[p.email] = {
        contact_name: p.contact_name || '',
        contact_title: p.contact_title || '',
        contact_phone: p.contact_phone || '',
      }
    }
  }
  const { data: amounts } = await supabaseAdmin
    .from('school_amounts').select('school_id, school_year, sem1_amount, sem2_amount, approved_total').eq('school_year', activeSchoolYear)
  const { data: banks } = await supabaseAdmin
    .from('bank_accounts').select('school_id, semester, confirmed_at, is_modified, bank_name, branch_name, bank_code, account_name, account_number')
    .eq('school_year', activeSchoolYear)
  const { data: settlements } = await supabaseAdmin
    .from('settlements').select('id, school_id, semester, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, total_expense')
    .eq('school_year', activeSchoolYear)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar email={session.user.email ?? undefined} isAdmin={true} schoolYear={activeSchoolYear} systemName={settings.system_name} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AdminDashboardClient
          schools={schools || []}
          amounts={amounts || []}
          banks={banks || []}
          settlements={settlements || []}
          profiles={profiles || []}
          contacts={contacts}
          currentUserEmail={session.user.email ?? ''}
          activeSchoolYear={activeSchoolYear}
        />
      </main>
    </div>
  )
}
