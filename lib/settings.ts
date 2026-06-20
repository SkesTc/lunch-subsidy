import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'settlement-files'
const PATH = '__system/settings.json'

const DEFAULTS = {
  system_name: '臺中市第2區免費營養午餐核銷系統',
  host_school: '',
  school_year: '115',
  admin_name: '',
  admin_title: '',
  admin_phone: '',
  plan_name: '',
  manual_url: '',
}

export async function getSystemSettings(): Promise<typeof DEFAULTS & Record<string, string>> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(PATH)
    if (data) {
      const parsed = JSON.parse(await data.text())
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}
