import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'settlement-files'
const PATH = '__system/settings.json'

const DEFAULTS = {
  system_name: '免費營養午餐核銷系統',
  host_school: '',
  admin_name: '',
  admin_title: '',
  admin_phone: '',
  school_year: '115',
  active_school_year: '115',
  manual_url: '',
}

// 登入頁公開端點：直接讀 settings.json（SettingsTab 儲存處），不走 zone_settings
export async function GET() {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(PATH)
    if (data) {
      const parsed = JSON.parse(await data.text())
      return NextResponse.json({ ...DEFAULTS, ...parsed })
    }
  } catch { /* 忽略 */ }
  return NextResponse.json(DEFAULTS)
}
