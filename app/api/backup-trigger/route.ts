import { NextResponse } from 'next/server'
import { getGasSettings } from '@/lib/gas'
import { runBackup } from '@/lib/backup'

// 此端點專供 GAS 定時觸發呼叫，不需管理員 session（與 /api/admin/backup 的定時分支共用同一份實作）
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { gasSecret } = await getGasSettings()
  if (!gasSecret || body.secret !== gasSecret) {
    return NextResponse.json({ error: '驗證失敗' }, { status: 403 })
  }
  const { status, body: result } = await runBackup({ type: 'scheduled', notify: 'scheduled' })
  return NextResponse.json(result, { status })
}
