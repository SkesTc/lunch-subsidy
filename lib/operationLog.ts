import { supabaseAdmin } from '@/lib/supabase'

export async function writeLog(opts: {
  actorEmail: string
  actorRole?: string
  schoolId?: number | null
  schoolName?: string
  action: string
  detail: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabaseAdmin.from('operation_logs').insert({
      actor_email: opts.actorEmail,
      actor_role: opts.actorRole || null,
      school_id: opts.schoolId || null,
      school_name: opts.schoolName || null,
      action: opts.action,
      detail: opts.detail,
      metadata: opts.metadata || null,
    })
  } catch (e) {
    console.error('writeLog failed:', JSON.stringify(e))
  }
}
