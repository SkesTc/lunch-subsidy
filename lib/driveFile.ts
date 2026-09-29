import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase'
import { getGasSettings, gasGetFile } from '@/lib/gas'

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

// 統一取檔：path 不含 "/" 視為 Google Drive fileId，含 "/" 視為 Supabase Storage 路徑（舊制）
export async function fetchFileBytes(path: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!path.includes('/')) {
    const driveAuth = getDriveAuth()
    if (driveAuth) {
      const drive = google.drive({ version: 'v3', auth: driveAuth })
      const meta = await drive.files.get({ fileId: path, fields: 'mimeType' })
      const mimeType = meta.data.mimeType || 'application/octet-stream'
      const res = await drive.files.get({ fileId: path, alt: 'media' }, { responseType: 'arraybuffer' })
      return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType }
    }
    const { gasUrl, gasSecret } = await getGasSettings()
    if (!gasUrl) throw new Error('尚未設定 GAS 網址')
    const { base64, mimeType } = await gasGetFile({ gasUrl, gasSecret, fileId: path })
    return { buffer: Buffer.from(base64, 'base64'), mimeType }
  }
  const { data, error } = await supabaseAdmin.storage.from('settlement-files').download(path)
  if (error || !data) throw new Error(error?.message || '讀取檔案失敗')
  const mimeType = data.type || 'application/octet-stream'
  return { buffer: Buffer.from(await data.arrayBuffer()), mimeType }
}
