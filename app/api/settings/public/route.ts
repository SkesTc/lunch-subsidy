import { NextResponse } from 'next/server'
import { readGlobalSettingsRaw } from '@/lib/settings'

// 登入頁公開端點（不需登入）：只能回傳白名單欄位，切勿整包回傳設定檔（內含 GAS 金鑰等機密）
export async function GET() {
  const raw = await readGlobalSettingsRaw()
  const str = (k: string, fallback = '') => (typeof raw[k] === 'string' && raw[k] ? raw[k] as string : fallback)
  return NextResponse.json({
    system_name: str('system_name', '免費營養午餐核銷系統'),
    school_year: str('active_school_year', str('school_year', '115')),
    designer_name: str('designer_name'),
    designer_title: str('designer_title'),
  })
}
