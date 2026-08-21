import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// 公開端點：回傳各分區的聯絡資訊（不需要登入）
export async function GET() {
  const { data: zones } = await supabaseAdmin
    .from('zones')
    .select('id, name, host_school')
    .eq('is_active', true)
    .order('id')

  if (!zones || zones.length === 0) return NextResponse.json([])

  // 取各區的聯絡人設定
  const { data: settings } = await supabaseAdmin
    .from('zone_settings')
    .select('zone_id, key, value')
    .is('plan_id', null)
    .in('key', ['admin_name', 'admin_title', 'admin_phone'])

  const settingMap: Record<number, Record<string, string>> = {}
  for (const row of settings || []) {
    if (!settingMap[row.zone_id]) settingMap[row.zone_id] = {}
    settingMap[row.zone_id][row.key] = row.value
  }

  const result = zones.map(z => ({
    id: z.id,
    name: z.name,
    host_school: z.host_school || '',
    admin_name: settingMap[z.id]?.admin_name || '',
    admin_title: settingMap[z.id]?.admin_title || '',
    admin_phone: settingMap[z.id]?.admin_phone || '',
  })).filter(z => z.host_school || z.admin_name || z.admin_phone)

  return NextResponse.json(result)
}
