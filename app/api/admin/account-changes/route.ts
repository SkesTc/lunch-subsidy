import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserZoneRole, getZoneSchoolIds } from '@/lib/zones'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null

  const { data: files } = await supabaseAdmin.storage.from(BUCKET).list('__account-changes')
  if (!files?.length) return NextResponse.json([])

  const results = await Promise.all(
    files.filter(f => f.name.endsWith('.json')).map(async f => {
      try {
        const { data } = await supabaseAdmin.storage.from(BUCKET).download(`__account-changes/${f.name}`)
        if (data) return JSON.parse(await data.text())
      } catch (e) { console.error('account-changes:', e) }
      return null
    })
  )
  const all = results.filter(Boolean)
  if (allowedIds !== null) return NextResponse.json(all.filter((r: { school_id: number }) => allowedIds.includes(Number(r.school_id))))
  return NextResponse.json(all)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolId, schoolYear, action, adminNote } = await req.json()
  const zoneUser = await getUserZoneRole(session.user.email!)
  const allowedIds = zoneUser ? await getZoneSchoolIds(zoneUser) : null
  if (allowedIds !== null && !allowedIds.includes(Number(schoolId))) {
    return NextResponse.json({ error: '無權限審核此學校的申請' }, { status: 403 })
  }
  // action: 'approve' | 'reject'

  const path = `__account-changes/${schoolId}_${schoolYear}.json`
  const { data } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (!data) return NextResponse.json({ error: '找不到申請' }, { status: 404 })

  const request = JSON.parse(await data.text())

  if (action === 'approve') {
    const semester = request.semester || 1
    // Update bank_accounts
    const { data: existing } = await supabaseAdmin
      .from('bank_accounts').select('id')
      .eq('school_id', schoolId).eq('school_year', schoolYear).eq('semester', semester).single()

    const bankPayload = {
      school_id: schoolId,
      school_year: schoolYear,
      semester,
      ...request.new_info,
      is_preloaded: false,
      is_modified: true,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabaseAdmin.from('bank_accounts').update(bankPayload).eq('id', existing.id)
    } else {
      await supabaseAdmin.from('bank_accounts').insert(bankPayload)
    }
  }

  const updated = {
    ...request,
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewed_at: new Date().toISOString(),
    admin_note: adminNote || '',
  }

  const blob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' })
  await supabaseAdmin.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'application/json' })

  return NextResponse.json({ ok: true })
}
