// 向下相容：重新匯出 settings.ts 的 getGasSettings
export { getGasSettings } from './settings'

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

export async function gasGetFolderUrl(opts: {
  gasUrl: string
  gasSecret: string
  folderId: string
  subFolder: string
}): Promise<string | null> {
  const res = await fetch(opts.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'getFolderUrl',
      secret: opts.gasSecret,
      folderId: opts.folderId,
      subFolder: opts.subFolder,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) return null
  return (data.folderUrl as string) || null
}

export async function gasRenameFile(opts: {
  gasUrl: string
  gasSecret: string
  fileId: string
  filename?: string  // 若省略，GAS 將自動移除「待審_」前綴
}): Promise<void> {
  const res = await fetch(opts.gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rename', secret: opts.gasSecret, fileId: opts.fileId, ...(opts.filename ? { filename: opts.filename } : {}) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) throw new Error(data.error || 'GAS 改名失敗')
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
