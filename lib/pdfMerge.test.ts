import { describe, it, expect } from 'vitest'
import { PDFDocument, degrees } from 'pdf-lib'
import { fetchAllWithConcurrency, normalizeToA4, sniffKind, A4_WIDTH, A4_HEIGHT } from './pdfMerge'

describe('檔案格式判斷', () => {
  it('依檔案開頭位元組判斷，不依賴 Content-Type', () => {
    expect(sniffKind(Buffer.from('%PDF-1.7 ...'), 'application/octet-stream')).toBe('pdf')
    expect(sniffKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), 'application/octet-stream')).toBe('jpg')
    expect(sniffKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), 'binary/octet-stream')).toBe('png')
  })

  it('位元組無法判斷時才參考 Content-Type，都無法判斷回傳 null', () => {
    expect(sniffKind(Buffer.from('xx'), 'application/pdf')).toBe('pdf')
    expect(sniffKind(Buffer.from('GIF89a......'), 'image/gif')).toBeNull()
  })
})

describe('頁面尺寸統一為 A4', () => {
  async function sizesAfterNormalize(pages: { size: [number, number]; rotate?: number }[]) {
    const src = await PDFDocument.create()
    for (const p of pages) {
      const pg = src.addPage(p.size)
      if (p.rotate) pg.setRotation(degrees(p.rotate))
    }
    const merged = await PDFDocument.create()
    const copied = await merged.copyPages(src, src.getPageIndices())
    copied.forEach(p => { normalizeToA4(p); merged.addPage(p) })
    return merged.getPages().map(p => { const { width, height } = p.getSize(); return [Math.round(width), Math.round(height)] })
  }

  it('掃描像素尺寸、A3、橫向大頁都縮放到 A4 範圍內並維持方向', async () => {
    const sizes = await sizesAfterNormalize([
      { size: [2480, 3508] },          // 300dpi 掃描像素當點數
      { size: [842, 1191] },           // A3
      { size: [3508, 2480] },          // 橫向
    ])
    expect(sizes[0]).toEqual([Math.round(A4_WIDTH), Math.round(A4_HEIGHT)])
    expect(sizes[1]).toEqual([Math.round(A4_WIDTH), Math.round(A4_HEIGHT)])
    expect(sizes[2]).toEqual([Math.round(A4_HEIGHT), Math.round(A4_WIDTH)])
  })

  it('已是 A4 的頁面不變；有旋轉屬性的頁面依旋轉後方向計算', async () => {
    const sizes = await sizesAfterNormalize([{ size: [595, 842] }, { size: [595, 842], rotate: 90 }])
    expect(sizes[0]).toEqual([595, 842])
    expect(sizes[1]).toEqual([595, 842])
  })
})

describe('併發下載', () => {
  it('同時處理數不超過上限，且結果順序與輸入一致', async () => {
    let running = 0
    let peak = 0
    const items = Array.from({ length: 23 }, (_, i) => i)
    const out = await fetchAllWithConcurrency(items, 5, async n => {
      running++; peak = Math.max(peak, running)
      await new Promise(r => setTimeout(r, (23 - n) % 4))
      running--
      return n * 2
    })
    expect(out).toEqual(items.map(n => n * 2))
    expect(peak).toBeLessThanOrEqual(5)
  })
})
