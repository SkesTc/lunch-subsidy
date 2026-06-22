import { auth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.school_id) return NextResponse.json(null)
  const { data } = await supabaseAdmin
    .from('schools').select('id, code, district, name').eq('id', session.user.school_id).single()
  return NextResponse.json(data)
}
