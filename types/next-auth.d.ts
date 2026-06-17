import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      school_id?: number | null
      is_admin?: boolean
    }
  }
}
