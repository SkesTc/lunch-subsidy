import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

// 批次列印用：依學校編號排序，列出指定學期（＋計畫）已核准的結算表掃描檔或送款憑單
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') === 'remittance' ? 'remittance' : 'scan'
  const semester = Number(searchParams.get('semester') || '1') as 1 | 2
  const planId = searchParams.get('plan_id') || null
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()

  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  const schoolBaseQuery = supabaseAdmin.from('schools').select('id, code, name').eq('is_active', true).order('code')
  const schoolFinalQuery = allowedIds !== null ? schoolBaseQuery.in('id', allowedIds.length ? allowedIds : [-1]) : schoolBaseQuery

  const fileField = type === 'scan' ? 'scan_file_path' : 'remittance_file_path'
  const settleQuery = planId
    ? supabaseAdmin.from('settlements').select(`school_id, ${fileField}`).eq('school_year', schoolYear).eq('plan_id', planId).eq('semester', semester)
    : supabaseAdmin.from('settlements').select(`school_id, ${fileField}`).eq('school_year', schoolYear).eq('semester', semester).is('plan_id', null)

  const [{ data: schools }, { data: settles }] = await Promise.all([schoolFinalQuery, settleQuery])

  const fileMap = new Map((settles || []).map(s => [(s as Record<string, unknown>).school_id as number, (s as Record<string, unknown>)[fileField] as string | null]))

  const list = (schools || [])
    .map(s => ({ school_id: s.id, code: s.code, name: s.name, path: fileMap.get(s.id) || null }))
    .filter(s => !!s.path)

  return NextResponse.json({ list })
}
