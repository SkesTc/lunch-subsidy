import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '無權限' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') || '200')
  const search = searchParams.get('search') || ''

  let query = supabaseAdmin
    .from('login_logs')
    .select('id, email, school_name, is_admin, logged_in_at')
    .order('logged_in_at', { ascending: false })
    .limit(limit)

  if (search) {
    query = query.or(`email.ilike.%${search}%,school_name.ilike.%${search}%`)
  }

  const { data } = await query
  return NextResponse.json(data || [])
}
