import { cookies } from 'next/headers'

/**
 * 取得有效的 school_id：
 * - 一般學校用戶：使用 session.user.school_id
 * - 管理員模擬身分：讀取 school_impersonate cookie 中的 school_id
 */
export async function getEffectiveSchoolId(session: {
  user: { school_id?: number | null; is_admin?: boolean }
}): Promise<number | null> {
  if (session.user.is_admin) {
    const cookieStore = await cookies()
    const impCookie = cookieStore.get('school_impersonate')
    if (impCookie) {
      try {
        const { school_id } = JSON.parse(impCookie.value)
        if (school_id) return school_id
      } catch { /* 忽略 parse 錯誤 */ }
    }
  }
  return session.user.school_id ?? null
}
