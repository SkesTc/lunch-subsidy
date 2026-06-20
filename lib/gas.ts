import { supabaseAdmin } from './supabase'

const BUCKET = 'settlement-files'

export async function getGasSettings(): Promise<{ gasUrl: string; gasSecret: string; driveFolderId: string }> {
  try {
    const { data } = await supabaseAdmin.storage.from(BUCKET).download('__system/settings.json')
    if (data) {
      const s = JSON.parse(await data.text())
      return {
        gasUrl: s.gas_url || '',
        gasSecret: s.gas_secret || '',
        driveFolderId: s.drive_folder_id || '',
      }
    }
  } catch { /* ignore */ }
  return { gasUrl: '', gasSecret: '', driveFolderId: '' }
}

export async function gasUploadFile(opts: {
  gasUrl: string
  gasSecret: string
  folderId: string
  subFolder?: string
  filename: string
  mimeType: string
  buffer: ArrayBuffer
}): Promise<string> {
  const base64 = Buffer.from(opts.buffer).toString('base64')
  const res = await fetch(opts.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload',
      secret: opts.gasSecret,
      folderId: opts.folderId,
      subFolder: opts.subFolder || '',
      filename: opts.filename,
      mimeType: opts.mimeType,
      base64,
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'GAS 上傳失敗')
  return data.fileId as string
}

export async function gasDeleteFile(opts: {
  gasUrl: string
  gasSecret: string
  fileId: string
}): Promise<void> {
  const res = await fetch(opts.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'delete',
      secret: opts.gasSecret,
      fileId: opts.fileId,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || 'GAS 刪除失敗')
}
