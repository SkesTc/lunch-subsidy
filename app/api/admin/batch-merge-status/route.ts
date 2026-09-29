import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { batchMergeKey, getBatchMergeRecord } from '@/lib/batchMerge'

// 查詢先前已合併完成的批次檔記錄（供直接提供下載）
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') === 'remittance' ? 'remittance' : 'scan'
  const semester = Number(searchParams.get('semester') || '1')
  const planId = searchParams.get('plan_id') || null
  const schoolYear = searchParams.get('school_year') || await getActiveSchoolYear()

  const key = await batchMergeKey({ userEmail: session.user.email!, type, semester, planId, schoolYear })
  return NextResponse.json(await getBatchMergeRecord(key))
}
