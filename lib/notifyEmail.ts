import { supabaseAdmin } from '@/lib/supabase'
import { getGlobalSettings, getSettingsForZone, getGlobalSystemName, type AllSettings } from '@/lib/settings'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { wrapEmailHtml } from '@/lib/email-html'
import { renderTemplate } from '@/lib/notifyTemplates'

export interface NotifyRecipient {
  schoolId: number
  schoolName: string
  email: string
  subject: string
  text: string
  html: string
}

// 依「每間學校所屬分區」與計畫／學期，組出催收信件（寄送與預覽共用，確保預覽即實際內容）
export async function buildNotifyRecipients(opts: {
  schoolIds: number[]
  subject: string
  message: string
  semester: number
  planId: string | null
}): Promise<{ recipients: NotifyRecipient[]; globalSettings: AllSettings }> {
  const { schoolIds, semester, planId } = opts
  const [globalSettings, globalSystemName, schoolYear] = await Promise.all([
    getGlobalSettings(), getGlobalSystemName(), getActiveSchoolYear(),
  ])

  const settleQ = supabaseAdmin.from('settlements').select('school_id, repay_amount')
    .in('school_id', schoolIds).eq('school_year', schoolYear).eq('semester', semester)
  const [{ data: schools }, { data: profiles }, { data: settles }, { data: plan }] = await Promise.all([
    supabaseAdmin.from('schools').select('id, name, zone_id').in('id', schoolIds),
    supabaseAdmin.from('user_profiles').select('email, school_id, contact_name, contact_title')
      .in('school_id', schoolIds).eq('is_admin', false),
    planId ? settleQ.eq('plan_id', planId) : settleQ.is('plan_id', null),
    planId
      ? supabaseAdmin.from('plans').select('label, semester, deadline').eq('id', planId).maybeSingle()
      : Promise.resolve({ data: null as { label: string; semester: number | null; deadline: string | null } | null }),
  ])

  const zoneIds = [...new Set((schools || []).map(s => s.zone_id).filter((z): z is number => z != null))]
  const [{ data: zoneRows }, zoneSettingsList] = await Promise.all([
    supabaseAdmin.from('zones').select('id, name').in('id', zoneIds.length ? zoneIds : [-1]),
    Promise.all(zoneIds.map(z => getSettingsForZone(z))),
  ])
  const zoneSettings = new Map(zoneIds.map((z, i) => [z, zoneSettingsList[i]]))
  const zoneNames = new Map((zoneRows || []).map(z => [z.id as number, z.name as string]))
  const schoolMap = new Map((schools || []).map(s => [s.id as number, s]))
  const repayMap = new Map((settles || []).map(s => [s.school_id as number, Number(s.repay_amount) || 0]))

  const semLabel = plan
    ? `${schoolYear}學年度${plan.label}${plan.semester == null ? `第${semester}學期` : ''}`
    : `${schoolYear}學年度第${semester}學期`
  const fallbackDeadline = String((semester === 1 ? globalSettings.block2_deadline : globalSettings.block3_deadline) || '')
  const deadline = plan?.deadline || fallbackDeadline || '規定期限'

  const recipients = (profiles || []).map(p => {
    const school = schoolMap.get(p.school_id as number)
    const zoneId = (school?.zone_id as number | null) ?? null
    const s = (zoneId !== null && zoneSettings.get(zoneId)) || globalSettings
    const zoneName = (zoneId !== null && zoneNames.get(zoneId)) || String(s.system_name || '')
    const vars: Record<string, string> = {
      schoolName: school?.name || '',
      contactName: p.contact_name || '承辦人',
      contactTitle: p.contact_name ? (p.contact_title || '') : '',
      semLabel,
      deadline,
      repayAmount: (repayMap.get(p.school_id as number) || 0).toLocaleString('zh-TW'),
      hostSchool: String(s.host_school || ''),
      adminName: String(s.admin_name || '承辦人員'),
      adminTitle: String(s.admin_title || ''),
      adminPhone: String(s.admin_phone || ''),
      zoneName,
    }
    const text = renderTemplate(opts.message, vars)
    return {
      schoolId: p.school_id as number,
      schoolName: vars.schoolName,
      email: p.email as string,
      subject: renderTemplate(opts.subject, vars),
      text,
      html: wrapEmailHtml({
        body: text, zoneName, systemName: globalSystemName,
        hostSchool: vars.hostSchool, adminName: vars.adminName, adminTitle: vars.adminTitle, adminPhone: vars.adminPhone,
      }),
    }
  })

  return { recipients, globalSettings }
}
