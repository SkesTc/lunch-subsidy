import type { PDFPage } from 'pdf-lib'

export const A4_WIDTH = 595.28
export const A4_HEIGHT = 841.89

// 併發抓取所有檔案（保留原始順序），避免逐校序列下載導致逾時
export async function fetchAllWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

// 將 PDF 頁面等比例縮放成 A4（保留橫/直向），避免來源檔頁面尺寸不一（A3、Letter、以像素為單位的大尺寸）導致預覽時忽大忽小
export function normalizeToA4(page: PDFPage) {
  const swapped = page.getRotation().angle % 180 !== 0
  const { width, height } = page.getSize()
  const ew = swapped ? height : width
  const eh = swapped ? width : height
  const landscape = ew > eh
  const tw = landscape ? A4_HEIGHT : A4_WIDTH
  const th = landscape ? A4_WIDTH : A4_HEIGHT
  const k = Math.min(tw / ew, th / eh)
  if (Number.isFinite(k) && k > 0 && Math.abs(k - 1) > 0.01) page.scale(k, k)
}

// 以檔案開頭位元組判斷格式，不依賴 Drive 回傳的 Content-Type
export function sniffKind(buf: Buffer, mimeType: string): 'pdf' | 'jpg' | 'png' | null {
  if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 8 && buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'png'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  return null
}
