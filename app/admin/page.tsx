import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear, getSchoolYears } from '@/lib/schoolYear'
import { getSystemSettings } from '@/lib/settings'
import Navbar from '@/components/Navbar'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.is_admin) redirect('/school')

  const [activeSchoolYear, allSchoolYears, settings] = await Promise.all([
    getActiveSchoolYear(), getSchoolYears(), getSystemSettings(),
  ])

  const { data: schools } = await supabaseAdmin
    .from('schools').select('id, code, district, name').eq('is_active', true).order('code')
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles').select('email, school_id, is_admin').eq('is_admin', false)

  // Load contact info for all bound users
  const { data: contactFiles } = await supabaseAdmin.storage.from('settlement-files').list('__contacts')
  const contacts: Record<string, { contact_name: string; contact_title: string; contact_phone: string }> = {}
  if (contactFiles?.length) {
    await Promise.all(contactFiles.map(async f => {
      try {
        const { data } = await supabaseAdmin.storage.from('settlement-files').download(`__contacts/${f.name}`)
        if (data) {
          const parsed = JSON.parse(await data.text())
          const email = f.name.replace('_at_', '@').replace(/_/g, '.').replace('.json', '')
          contacts[email] = { contact_name: parsed.contact_name || '', contact_title: parsed.contact_title || '', contact_phone: parsed.contact_phone || '' }
        }
      } catch { /* ignore */ }
    }))
  }
  const { data: amounts } = await supabaseAdmin
    .from('school_amounts').select('*').eq('school_year', activeSchoolYear)
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
          allSchoolYears={allSchoolYears}
        />
      </main>
    </div>
  )
}
