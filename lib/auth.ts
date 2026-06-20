import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { supabaseAdmin } from './supabase'

const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim())

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      const isAdmin = adminEmails.includes(user.email)
      // 確保 user_profiles 有此使用者紀錄
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id, school_id, is_admin')
        .eq('email', user.email)
        .single()
      if (!profile) {
        await supabaseAdmin.from('user_profiles').insert({
          email: user.email,
          is_admin: isAdmin,
        })
      }
      // 寫入登入紀錄
      let schoolName: string | null = null
      const schoolId = profile?.school_id
      if (schoolId) {
        const { data: school } = await supabaseAdmin
          .from('schools').select('name').eq('id', schoolId).single()
        schoolName = school?.name || null
      }
      await supabaseAdmin.from('login_logs').insert({
        email: user.email,
        school_name: schoolName,
        is_admin: profile?.is_admin ?? isAdmin,
      })
      return true
    },
    async session({ session }) {
      if (!session.user?.email) return session
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('email', session.user.email)
        .single()
      if (data) {
        session.user.school_id = data.school_id
        session.user.is_admin = data.is_admin
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
