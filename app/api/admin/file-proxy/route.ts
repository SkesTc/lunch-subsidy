import { auth } from '@/lib/auth'
import { google } from 'googleapis'
import { NextResponse } from 'next/server'
import { getGasSettings } from '@/lib/gas'
import { gasGetFile } from '@/lib/gas'

function getDriveAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) return null
  try {
    const credentials = JSON.parse(json)
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: '未登入' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('fileId')
  if (!fileId) return NextResponse.json({ error: '缺少 fileId' }, { status: 400 })

  // 優先用 Drive API 直接串流（快）
  const driveAuth = getDriveAuth()
  if (driveAuth) {
    const drive = google.drive({ version: 'v3', auth: driveAuth })
    const meta = await drive.files.get({ fileId, fields: 'mimeType' })
    const mimeType = meta.data.mimeType || 'application/octet-stream'
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    const buffer = Buffer.from(res.data as ArrayBuffer)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=300',
      },
    })
  }

  // Fallback：透過 GAS 取得（較慢）
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
