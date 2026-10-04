import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getEffectiveSchoolId } from '@/lib/impersonate'
import { fetchFileBytes } from '@/lib/driveFile'
import { schoolOwnsFile } from '@/lib/fileAccess'

// 學校端檔案檢視：只能讀取自己學校的檔案
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })
  const schoolId = await getEffectiveSchoolId(session)
  if (!schoolId) return NextResponse.json({ error: '未綁定學校' }, { status: 403 })

  const fileId = new URL(req.url).searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: '缺少 fileId' }, { status: 400 })
  if (!(await schoolOwnsFile(schoolId, fileId))) return NextResponse.json({ error: '無權限檢視此檔案' }, { status: 403 })

  const { buffer, mimeType } = await fetchFileBytes(fileId)
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': mimeType, 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=300' },
  })
}
