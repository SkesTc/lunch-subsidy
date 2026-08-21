import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getSettingsForZone } from '@/lib/settings'
import { getUserZoneRole, isSuperAdmin, getZoneSchoolIds } from '@/lib/zones'
import Navbar from '@/components/Navbar'
import AdminDashboardClient from './AdminDashboardClient'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.is_admin) redirect('/school')

  const zoneUser = session.user.email ? await getUserZoneRole(session.user.email) : null
  const userRole = zoneUser?.role || 'zone_admin'

  // 用登入者所屬區別讀取設定；super_admin 預設讀全域（zone 1）
  const settingsZoneId = zoneUser?.zone_id || 1
  const [activeSchoolYear, settings] = await Promise.all([
    getActiveSchoolYear(), getSettingsForZone(settingsZoneId),
  ])

  // zone 過濾：非超級管理員只看自己區的學校
  const zoneSchoolIds = zoneUser && !isSuperAdmin(zoneUser) ? await getZoneSchoolIds(zoneUser) : null

  let schoolQuery = supabaseAdmin.from('schools').select('id, code, district, name, zone_id').eq('is_active', true).order('code')
  if (zoneSchoolIds !== null) {
    schoolQuery = schoolQuery.in('id', zoneSchoolIds.length ? zoneSchoolIds : [-1])
  }
  const { data: schools } = await schoolQuery

  // 取出過濾後的 school id 清單
  const visibleSchoolIds = (schools || []).map(s => s.id)

  let profilesQuery = supabaseAdmin
    .from('user_profiles')
    .select('email, school_id, is_admin, contact_name, contact_title, contact_phone')
    .eq('is_admin', false)
  if (zoneSchoolIds !== null && visibleSchoolIds.length > 0) {
    profilesQuery = profilesQuery.in('school_id', visibleSchoolIds)
  } else if (zoneSchoolIds !== null) {
    profilesQuery = profilesQuery.in('school_id', [-1])
  }
  const { data: profilesData } = await profilesQuery

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

  const ids = zoneSchoolIds !== null ? (visibleSchoolIds.length ? visibleSchoolIds : [-1]) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addFilter = (q: any) => ids !== null ? q.in('school_id', ids) : q

  const [{ data: amounts }, { data: banks }, { data: settlements }, { data: plans }, { data: planAmounts }] = await Promise.all([
    addFilter(supabaseAdmin.from('school_amounts').select('school_id, school_year, sem1_amount, sem2_amount, approved_total').eq('school_year', activeSchoolYear)),
    addFilter(supabaseAdmin.from('bank_accounts').select('school_id, semester, confirmed_at, is_modified, bank_name, branch_name, bank_code, account_name, account_number').eq('school_year', activeSchoolYear)),
    addFilter(supabaseAdmin.from('settlements').select('id, school_id, semester, plan_id, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, total_expense').eq('school_year', activeSchoolYear)),
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabaseAdmin.from('plans').select('*').eq('school_year', activeSchoolYear).eq('is_active', true).order('sort_order')
      if (zoneUser && !isSuperAdmin(zoneUser) && zoneUser.zone_id) {
        q = q.contains('zone_ids', [zoneUser.zone_id])
      }
      return q
    })(),
    addFilter(supabaseAdmin.from('plan_amounts').select('school_id, plan_id, semester, amount').eq('school_year', activeSchoolYear)),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar email={session.user.email ?? undefined} isAdmin={true} schoolYear={activeSchoolYear} systemName={settings.system_name} adminManualUrl={settings.admin_manual_url as string || ''} currentPage="admin" />
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
          plans={plans || []}
          planAmounts={planAmounts || []}
          adminManualUrl={settings.admin_manual_url as string || ''}
          userRole={userRole}
        />
      </main>
    </div>
  )
}
