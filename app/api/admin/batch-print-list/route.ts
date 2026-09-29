import { auth } from '@/lib/auth'
import { getBatchPrintList } from '@/lib/batchPrint'
import { NextResponse } from 'next/server'

// 批次列印用：依學校編號排序，列出指定學期（＋計畫）已核准的結算表掃描檔或送款憑單
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') === 'remittance' ? 'remittance' : 'scan'
  const semester = Number(searchParams.get('semester') || '1') as 1 | 2
  const planId = searchParams.get('plan_id') || null
  const schoolYear = searchParams.get('school_year') || undefined

  const list = await getBatchPrintList({ userEmail: session.user.email!, type, semester, planId, schoolYear })
  return NextResponse.json({ list })
}
