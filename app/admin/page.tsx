import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { getGlobalSettings } from '@/lib/settings'
import { getUserZoneRole, isSuperAdmin } from '@/lib/zones'
import Navbar from '@/components/Navbar'
import AdminDashboardClient from './AdminDashboardClient'
import { DialogProvider } from '@/components/DialogProvider'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.is_admin) redirect('/school')

  // 第 1 輪：角色與全域設定同時查（導覽列只需要全域欄位）
  const [zoneUser, settings] = await Promise.all([
    session.user.email ? getUserZoneRole(session.user.email) : Promise.resolve(null),
    getGlobalSettings(),
  ])
  const userRole = zoneUser?.role || 'zone_admin'
  const activeSchoolYear = String(settings.active_school_year || settings.school_year || '115')
  // 與 getZoneSchoolIds 相同規則：非超級管理者且有指定分區時才限縮範圍
  const zoneOnly = zoneUser && !isSuperAdmin(zoneUser) && zoneUser.zone_id ? zoneUser.zone_id : null

  // 第 2 輪：其餘資料全部同時查；區管理者的分區過濾在伺服器端完成，不會多送資料到瀏覽器
  let schoolQuery = supabaseAdmin.from('schools').select('id, code, district, name, zone_id').eq('is_active', true).order('code')
  if (zoneOnly) schoolQuery = schoolQuery.eq('zone_id', zoneOnly)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let planQuery: any = supabaseAdmin.from('plans').select('*').eq('school_year', activeSchoolYear).eq('is_active', true).order('sort_order')
  if (zoneOnly) planQuery = planQuery.contains('zone_ids', [zoneOnly])

  const [
    { data: schools }, { data: profilesData }, { data: amountsAll }, { data: banksAll },
    { data: settlementsAll }, { data: plans }, { data: planAmountsAll },
  ] = await Promise.all([
    schoolQuery,
    supabaseAdmin.from('user_profiles').select('email, school_id, is_admin, contact_name, contact_title, contact_phone').eq('is_admin', false),
    supabaseAdmin.from('school_amounts').select('school_id, school_year, sem1_amount, sem2_amount, approved_total').eq('school_year', activeSchoolYear),
    supabaseAdmin.from('bank_accounts').select('school_id, semester, confirmed_at, is_modified, bank_name, branch_name, bank_code, account_name, account_number').eq('school_year', activeSchoolYear),
    supabaseAdmin.from('settlements').select('id, school_id, semester, plan_id, status, scan_file_path, remittance_file_path, remittance_date, repay_amount, surplus, total_expense').eq('school_year', activeSchoolYear),
    planQuery,
    supabaseAdmin.from('plan_amounts').select('school_id, plan_id, semester, amount').eq('school_year', activeSchoolYear),
  ])

  // 超級管理者看全部；區管理者只保留自己分區學校的資料
  const visible = zoneOnly ? new Set((schools || []).map(s => s.id as number)) : null
  const own = <T extends { school_id: number | null }>(rows: T[] | null) => (rows || []).filter(r => visible === null || (r.school_id !== null && visible.has(r.school_id)))
  const profiles = own(profilesData)
  const amounts = own(amountsAll)
  const banks = own(banksAll)
  const settlements = own(settlementsAll)
  const planAmounts = own(planAmountsAll)

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar email={session.user.email ?? undefined} isAdmin={true} schoolYear={activeSchoolYear} systemName={settings.system_name} adminManualUrl={settings.admin_manual_url as string || ''} currentPage="admin" />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <DialogProvider>
        <AdminDashboardClient
          schools={schools || []}
          amounts={amounts}
          banks={banks}
          settlements={settlements}
          profiles={profiles}
          contacts={contacts}
          currentUserEmail={session.user.email ?? ''}
          activeSchoolYear={activeSchoolYear}
          plans={plans || []}
          planAmounts={planAmounts}
          adminManualUrl={settings.admin_manual_url as string || ''}
          userRole={userRole}
        />
        </DialogProvider>
      </main>
    </div>
  )
}
