/**
 * 使用者 profile 快取（school_id + is_admin）
 * 避免每次 auth() 呼叫都查 user_profiles 表
 * TTL: 5 分鐘；綁定或變更學校時主動失效
 */
import { supabaseAdmin } from './supabase'

interface ProfileData {
  school_id: number | null
  is_admin: boolean
}

const cache = new Map<string, { data: ProfileData; ts: number }>()
const TTL = 5 * 60 * 1000 // 5 分鐘

export async function getCachedProfile(email: string): Promise<ProfileData | null> {
  const hit = cache.get(email)
  if (hit && Date.now() - hit.ts < TTL) return hit.data

  const { data } = await supabaseAdmin
    .from('user_profiles')
    .select('school_id, is_admin')
    .eq('email', email)
    .single()

  if (!data) return null
  const profile: ProfileData = { school_id: data.school_id ?? null, is_admin: data.is_admin ?? false }
  cache.set(email, { data: profile, ts: Date.now() })
  return profile
}

/** 綁定學校、解綁、設定管理員後呼叫，強制下次重新從 DB 讀取 */
export function invalidateProfileCache(email: string) {
  cache.delete(email)
}
