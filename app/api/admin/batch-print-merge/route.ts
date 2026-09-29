import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getBatchPrintList } from '@/lib/batchPrint'
import { fetchFileBytes } from '@/lib/driveFile'

export const maxDuration = 60

const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89
const MARGIN = 24

// 將所有學校的已核准檔案（PDF 直接併頁，圖片轉成一頁）依編號順序合併成單一 PDF
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.is_admin) return NextResponse.json({ error: '權限不足' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') === 'remittance' ? 'remittance' : 'scan'
  const semester = Number(searchParams.get('semester') || '1') as 1 | 2
  const planId = searchParams.get('plan_id') || null
  const schoolYear = searchParams.get('school_year') || undefined

  const list = await getBatchPrintList({ userEmail: session.user.email!, type, semester, planId, schoolYear })
  if (list.length === 0) return NextResponse.json({ error: '沒有已核准的檔案可合併' }, { status: 404 })
  if (list.length > 80) return NextResponse.json({ error: `學校數過多（${list.length} 校），請縮小範圍（例如分區別或計畫）後再試` }, { status: 400 })

  const merged = await PDFDocument.create()
  const font = await merged.embedFont(StandardFonts.Helvetica)
  const errors: string[] = []

  for (const item of list) {
    try {
      const { buffer, mimeType } = await fetchFileBytes(item.path)
      if (mimeType === 'application/pdf') {
        const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
        const img = mimeType === 'image/jpeg' ? await merged.embedJpg(buffer) : await merged.embedPng(buffer)
        const page = merged.addPage([A4_WIDTH, A4_HEIGHT])
        const maxW = A4_WIDTH - MARGIN * 2
        const maxH = A4_HEIGHT - MARGIN * 2
        const scale = Math.min(maxW / img.width, maxH / img.height, 1)
        const w = img.width * scale
        const h = img.height * scale
        page.drawImage(img, { x: (A4_WIDTH - w) / 2, y: (A4_HEIGHT - h) / 2, width: w, height: h })
      } else {
        throw new Error(`不支援的檔案格式：${mimeType}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${String(item.code).padStart(3, '0')} ${item.name}：${msg}`)
      // 失敗的學校改插入一頁錯誤說明，讓合併結果的頁序仍與名冊一致
      const page = merged.addPage([A4_WIDTH, A4_HEIGHT])
      page.drawText(`${item.name}（編號 ${item.code}）`, { x: MARGIN, y: A4_HEIGHT - 100, size: 16, font })
      page.drawText('此校檔案無法自動合併，請至系統另行開啟列印', { x: MARGIN, y: A4_HEIGHT - 130, size: 12, font, color: rgb(0.8, 0.2, 0.2) })
      page.drawText(msg, { x: MARGIN, y: A4_HEIGHT - 150, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
    }
  }

  const pdfBytes = await merged.save()
  const typeLabel = type === 'scan' ? '結算表' : '送款憑單'
  const filename = `批次列印_${typeLabel}_第${semester}學期.pdf`

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'X-Merge-Errors': String(errors.length),
    },
  })
}
