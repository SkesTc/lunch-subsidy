import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { A4_WIDTH, A4_HEIGHT, fetchAllWithConcurrency, normalizeToA4, sniffKind } from '@/lib/pdfMerge'
import { getBatchPrintList } from '@/lib/batchPrint'
import { fetchFileBytes } from '@/lib/driveFile'
import { getGasSettings, gasUploadFile } from '@/lib/gas'
import { getActiveSchoolYear } from '@/lib/schoolYear'
import { batchMergeKey, saveBatchMergePart } from '@/lib/batchMerge'

export const maxDuration = 300

const MARGIN = 24
const FETCH_CONCURRENCY = 10
const PART_SIZE = 50

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

  const { gasUrl, gasSecret, driveFolderId } = await getGasSettings()
  if (!gasUrl || !driveFolderId) return NextResponse.json({ error: '尚未設定 GAS 網址或 Google Drive 資料夾 ID' }, { status: 500 })
  const year = schoolYear || await getActiveSchoolYear()
  const userEmail = session.user.email!

  // 以 NDJSON 串流回報進度：每行一個 JSON（progress / done / error）
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'))
      try {
        const n = list.length
        let fetchDone = 0
        let mergeDone = 0
        const progress = (label: string, pct?: number) =>
          send({ type: 'progress', label, pct: pct ?? Math.round(((fetchDone + mergeDone) / (2 * n)) * 90) })

        progress(`下載檔案 0/${n}`, 0)
        // 先併發抓取所有檔案內容（I/O 密集，平行處理避免逾時），再依序合併（CPU 處理，速度快）
        const fetched = await fetchAllWithConcurrency(list, FETCH_CONCURRENCY, async item => {
          let r
          try {
            const { buffer, mimeType } = await fetchFileBytes(item.path)
            r = { item, buffer, mimeType, error: null as string | null }
          } catch (e) {
            r = { item, buffer: null, mimeType: null, error: e instanceof Error ? e.message : String(e) }
          }
          fetchDone++
          progress(`下載檔案 ${fetchDone}/${n}`)
          return r
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
              pages.forEach(p => { normalizeToA4(p); merged.addPage(p) })
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
          mergeDone++
          progress(`合併 ${mergeDone}/${n}`)
        }

        progress('產生 PDF 檔案…', 92)
        const pdfBytes = await merged.save()
        const typeLabel = type === 'scan' ? '結算表' : '送款憑單'
        const partSuffix = totalParts > 1 ? `_第${part}份（共${totalParts}份）` : ''
        const filename = `批次列印_${typeLabel}_第${semester}學期${partSuffix}.pdf`

        // 合併檔存入 Drive 並只回傳檔案 ID（避免 Vercel 回應大小上限 4.5MB）
        progress('儲存至 Google Drive…', 95)
        const fileId = await gasUploadFile({
          gasUrl, gasSecret, folderId: driveFolderId,
          subFolder: `${year}學年度/批次列印`,
          filename, mimeType: 'application/pdf',
          buffer: pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer,
        })
        const key = await batchMergeKey({ userEmail, type, semester, planId, schoolYear: year })
        await saveBatchMergePart(key, { part, total: fullList.length, partCount: totalParts, fileId, filename, errors })
        send({ type: 'done', ok: true, fileId, url: `https://drive.google.com/file/d/${fileId}/view`, filename, totalParts, errors })
      } catch (e) {
        send({ type: 'error', error: e instanceof Error ? e.message : String(e) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } })
}
