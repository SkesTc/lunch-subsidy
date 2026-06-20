import { supabaseAdmin } from './supabase'

const BUCKET = 'settlement-files'
const SETTINGS_PATH = '__system/settings.json'

export async function getActiveSchoolYear(): Promise<string> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(SETTINGS_PATH)
    if (data) {
      const s = JSON.parse(await data.text())
      if (s.active_school_year) return s.active_school_year
      if (s.school_year) return s.school_year
    }
  } catch { /* ignore */ }
  return '115'
}

export async function getSchoolYears(): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(SETTINGS_PATH)
    if (data) {
      const s = JSON.parse(await data.text())
      if (Array.isArray(s.school_years) && s.school_years.length > 0) return s.school_years
    }
  } catch { /* ignore */ }
  return ['115']
}
