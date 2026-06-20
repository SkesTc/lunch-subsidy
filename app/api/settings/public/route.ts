import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const DEFAULTS = { system_name: '臺中市第2區免費營養午餐核銷系統', host_school: '', admin_name: '', admin_title: '', admin_phone: '', school_year: '115', plan_name: '' }

export async function GET() {
  const { data } = await supabaseAdmin.storage
    .from('settlement-files')
    .download('__system/settings.json')

  if (!data) return NextResponse.json(DEFAULTS)
  try {
    const parsed = JSON.parse(await data.text())
    return NextResponse.json({ ...DEFAULTS, ...parsed })
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}
