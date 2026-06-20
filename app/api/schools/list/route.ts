import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('schools').select('id, code, district, name').eq('is_active', true).order('code')
  return NextResponse.json(data || [])
}
