import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getBatchPrintList } from '@/lib/batchPrint'
import { fetchFileBytes } from '@/lib/driveFile'
import { getGasSettings, gasUploadFile } from '@/lib/gas'
import { getActiveSchoolYear } from '@/lib/schoolYear'

export const maxDuration = 300

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN = 24
const FETCH_CONCURRENCY = 10
const PART_SIZE = 50

// 併發抓取所有檔案（保留原始順序），避免逐校序列下載導致逾時
async function fetchAllWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
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

// 以檔案開頭位元組判斷格式，不依賴 Drive 回傳的 Content-Type
function sniffKind(buf: Buffer, mimeType: string): 'pdf' | 'jpg' | 'png' | null {
  if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 8 && buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'png'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  return null
}

// 將所有學校的已核准檔案（PDF 直接併頁，圖片轉成一頁）依編號順序合併成單一 PDF
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') === 'remittance' ? 'remittance' : 'scan'
  const semester = Number(searchParams.get('semester') || '1') as 1 | 2
  const planId = searchParams.get('plan_id') || null
  const schoolYear = searchParams.get('school_year') || undefined

  const part = Math.max(1, Number(searchParams.get('part') || '1'))

  const fullList = await getBatchPrintList({ userEmail: session.user.email!, type, semester, planId, schoolYear })
  if (fullList.length === 0) return NextResponse.json({ error: '沒有已核准的檔案可合併' }, { status: 404 })
  const totalParts = Math.ceil(fullList.length / PART_SIZE)
  if (part > totalParts) return NextResponse.json({ error: `不存在第 ${part} 份（共 ${totalParts} 份）` }, { status: 400 })
  const list = fullList.slice((part - 1) * PART_SIZE, part * PART_SIZE)

  // 先併發抓取所有檔案內容（I/O 密集，平行處理避免逾時），再依序合併（CPU 處理，速度快）
  const fetched = await fetchAllWithConcurrency(list, FETCH_CONCURRENCY, async item => {
    try {
      const { buffer, mimeType } = await fetchFileBytes(item.path)
      return { item, buffer, mimeType, error: null as string | null }
    } catch (e) {
      return { item, buffer: null, mimeType: null, error: e instanceof Error ? e.message : String(e) }
    }
  })

  const merged = await PDFDocument.create()
  const font = await merged.embedFont(StandardFonts.Helvetica)
  const errors: string[] = []

  for (const { item, buffer, mimeType, error: fetchError } of fetched) {
    try {
      if (fetchError || !buffer || !mimeType) throw new Error(fetchError || '下載失敗')
      const kind = sniffKind(buffer, mimeType)
      if (kind === 'pdf') {
        const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      } else if (kind === 'jpg' || kind === 'png') {
        const img = kind === 'jpg' ? await merged.embedJpg(buffer) : await merged.embedPng(buffer)
        const page = merged.addPage([A4_WIDTH, A4_HEIGHT])
        const maxW = A4_WIDTH - MARGIN * 2
        const maxH = A4_HEIGHT - MARGIN * 2
        const scale = Math.min(maxW / img.width, maxH / img.height, 1)
        const w = img.width * scale
        const h = img.height * scale
        page.drawImage(img, { x: (A4_WIDTH - w) / 2, y: (A4_HEIGHT - h) / 2, width: w, height: h })
      } else {
        throw new Error(`不支援的檔案格式：${mimeType}（${buffer.length} bytes）`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${String(item.code).padStart(3, '0')} ${item.name}：${msg}`)
      // 失敗的學校改插入一頁錯誤說明，讓合併結果的頁序仍與名冊一致
      const page = merged.addPage([A4_WIDTH, A4_HEIGHT])
      page.drawText(`School code ${String(item.code).padStart(3, '0')}`, { x: MARGIN, y: A4_HEIGHT - 100, size: 16, font })
      page.drawText('This file could not be merged. Please open and print it separately.', { x: MARGIN, y: A4_HEIGHT - 130, size: 12, font, color: rgb(0.8, 0.2, 0.2) })
    }
  }

  const pdfBytes = await merged.save()
  const typeLabel = type === 'scan' ? '結算表' : '送款憑單'
  const partSuffix = totalParts > 1 ? `_第${part}份（共${totalParts}份）` : ''
  const filename = `批次列印_${typeLabel}_第${semester}學期${partSuffix}.pdf`

  // 合併檔存入 Drive 並只回傳連結（避免 Vercel 回應大小上限 4.5MB）
  const { gasUrl, gasSecret, driveFolderId } = await getGasSettings()
  if (!gasUrl || !driveFolderId) return NextResponse.json({ error: '尚未設定 GAS 網址或 Google Drive 資料夾 ID' }, { status: 500 })
  const year = schoolYear || await getActiveSchoolYear()
  try {
    const fileId = await gasUploadFile({
      gasUrl, gasSecret, folderId: driveFolderId,
      subFolder: `${year}學年度/批次列印`,
      filename, mimeType: 'application/pdf',
      buffer: pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer,
    })
    return NextResponse.json({ ok: true, fileId, url: `https://drive.google.com/file/d/${fileId}/view`, filename, totalParts, errors })
  } catch (e) {
    return NextResponse.json({ error: `儲存合併檔至 Drive 失敗：${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
