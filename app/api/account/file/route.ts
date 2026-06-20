import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: '無路徑' }, { status: 400 })

  // Only allow access to own school's files
  if (!path.startsWith(`${session.user.school_id}/`)) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('settlement-files')
    .createSignedUrl(path, 300)

  if (error || !data?.signedUrl) return NextResponse.json({ error: '無法產生連結' }, { status: 500 })

  return NextResponse.redirect(data.signedUrl)
}
