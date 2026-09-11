import { auth } from '@/lib/auth'
import { getGasSettings } from '@/lib/gas'
import { gasGetFile } from '@/lib/gas'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: '缺少 fileId' }, { status: 400 })

  const { gasUrl, gasSecret } = await getGasSettings()
  if (!gasUrl) return NextResponse.json({ error: '尚未設定 GAS 網址' }, { status: 500 })

  const { base64, mimeType } = await gasGetFile({ gasUrl, gasSecret, fileId })
  const buffer = Buffer.from(base64, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
