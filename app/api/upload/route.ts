import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const fd = await req.formData()
  const file = fd.get('file') as File
  const semester = fd.get('semester') as string
  const type = fd.get('type') as 'settlement' | 'remittance'
  const remittanceDate = fd.get('remittance_date') as string | null

  if (!file) return NextResponse.json({ error: '無檔案' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const path = `${session.user.school_id}/${semester}/${type}_${Date.now()}.${ext}`

  const bytes = await file.arrayBuffer()
  const { error: uploadErr } = await supabaseAdmin.storage
    .from('settlement-files')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // 更新資料庫
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (type === 'settlement') {
    updateData.scan_file_path = path
    updateData.scan_uploaded_at = new Date().toISOString()
    updateData.status = 'uploaded'
  } else {
    updateData.remittance_file_path = path
    updateData.remittance_date = remittanceDate
  }

  const { data: existing } = await supabaseAdmin
    .from('settlements').select('id')
    .eq('school_id', session.user.school_id).eq('semester', Number(semester)).single()

  if (existing) {
    await supabaseAdmin.from('settlements').update(updateData).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('settlements').insert({
      school_id: session.user.school_id,
      semester: Number(semester),
      ...updateData,
    })
  }

  return NextResponse.json({ ok: true, path })
}
