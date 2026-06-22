import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'

export async function GET() {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

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
  return NextResponse.json(results.filter(Boolean))
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { schoolId, schoolYear, action, adminNote } = await req.json()
  // action: 'approve' | 'reject'

  const path = `__account-changes/${schoolId}_${schoolYear}.json`
  const { data } = await supabaseAdmin.storage.from(BUCKET).download(path)
  if (!data) return NextResponse.json({ error: '找不到申請' }, { status: 404 })

  const request = JSON.parse(await data.text())

  if (action === 'approve') {
    // Update bank_accounts
    const { data: existing } = await supabaseAdmin
      .from('bank_accounts').select('id')
      .eq('school_id', schoolId).eq('school_year', schoolYear).single()

    const bankPayload = {
      school_id: schoolId,
      school_year: schoolYear,
      semester: 1,
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
