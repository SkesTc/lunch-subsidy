import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, isSuperAdmin, getAllZones } from '@/lib/zones'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const zoneUser = await getUserZoneRole(session.user.email!)
  if (!zoneUser || !isSuperAdmin(zoneUser)) return NextResponse.json({ error: '僅超級管理員可查看' }, { status: 403 })

  const [zones, schoolYear] = await Promise.all([getAllZones(), getActiveSchoolYear()])

  const { data: schools } = await supabaseAdmin
    .from('schools')
    .select('id, zone_id, is_active')

  const { data: settlements } = await supabaseAdmin
    .from('settlements')
    .select('school_id, semester, status')
    .eq('school_year', schoolYear)

  const schoolsByZone = new Map<number, typeof schools>()
  for (const s of schools || []) {
    const arr = schoolsByZone.get(s.zone_id) || []
    arr.push(s)
    schoolsByZone.set(s.zone_id, arr)
  }

  const settleBySchool = new Map<number, { sem: number; status: string }[]>()
  for (const st of settlements || []) {
    const arr = settleBySchool.get(st.school_id) || []
    arr.push({ sem: st.semester, status: st.status })
    settleBySchool.set(st.school_id, arr)
  }

  const overview = zones.map(zone => {
    const zoneSchools = (schoolsByZone.get(zone.id) || []).filter(s => s.is_active)
    const total = zoneSchools.length

    let submitted = 0, approved = 0, pending = 0, notStarted = 0
    for (const school of zoneSchools) {
      const sts = settleBySchool.get(school.id) || []
      if (sts.length === 0) { notStarted++; continue }
      // settlements.status 實際值: draft, downloaded, uploaded
      const hasUploaded = sts.some(s => s.status === 'uploaded')
      const hasDownloaded = sts.some(s => s.status === 'downloaded')
      const hasDraft = sts.some(s => s.status === 'draft')
      if (hasUploaded) { approved++; submitted++ }
      else if (hasDownloaded || hasDraft) pending++
      else notStarted++
    }

    return {
      zone_id: zone.id,
      zone_name: zone.name,
      host_school: zone.host_school,
      total_schools: total,
      uploaded: submitted,   // 已上傳掃描檔
      in_progress: pending,  // 進行中（已儲存/已下載）
      not_started: notStarted,
    }
  })

  return NextResponse.json({ school_year: schoolYear, zones: overview })
}
