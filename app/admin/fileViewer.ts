// 後台統一用可旋轉、縮放的檢視器開啟上傳檔案（新分頁）
export function fileViewerUrl(path: string, opts: { name?: string; ext?: string | null; schoolId?: number } = {}) {
  const qs = new URLSearchParams({ fileId: path })
  if (opts.ext) qs.set('fileExt', opts.ext)
  if (opts.name) qs.set('name', opts.name)
  if (opts.schoolId) qs.set('school', String(opts.schoolId))
  return `/admin/file-viewer?${qs}`
}
