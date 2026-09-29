import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { fetchFileBytes } from '@/lib/driveFile'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: '缺少 fileId' }, { status: 400 })

  const { buffer, mimeType } = await fetchFileBytes(fileId)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  })
}
