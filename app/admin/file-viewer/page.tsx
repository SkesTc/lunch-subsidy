'use client'
import React, { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

declare global {
  interface Window { pdfjsLib: any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

type Kind = 'pdf' | 'image' | 'other'

function ToolbarBtn({ onClick, title, children, variant = 'default' }: {
  onClick?: () => void; title?: string; children: React.ReactNode
  variant?: 'default' | 'blue'
}) {
  const base = 'inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium transition-colors px-3 py-1.5 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
  const colors = { default: 'bg-white/10 hover:bg-white/20 text-white', blue: 'bg-blue-500/80 hover:bg-blue-500 text-white' }
  return <button onClick={onClick} title={title} aria-label={title} className={`${base} ${colors[variant]}`}>{children}</button>
}

async function loadPdfJs() {
  if (window.pdfjsLib) return
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
    script.type = 'module'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'
      resolve()
    }
    script.onerror = () => reject(new Error('PDF 檢視元件載入失敗'))
    document.head.appendChild(script)
  })
  // 模組腳本 onload 後全域變數可能稍晚才出現
  for (let i = 0; i < 50 && !window.pdfjsLib; i++) await new Promise(r => setTimeout(r, 100))
  if (!window.pdfjsLib) throw new Error('PDF 檢視元件載入逾時')
}

// 以檔案開頭位元組判斷類型（已核准的檔案沒有記錄副檔名）
async function detectKind(blob: Blob): Promise<Kind> {
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf'
  if (blob.type === 'application/pdf') return 'pdf'
  if (blob.type.startsWith('image/')) return 'image'
  if (head[0] === 0xff && head[1] === 0xd8) return 'image'
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image'
  return 'other'
}

export default function FileViewerPage() {
  return <Suspense fallback={null}><FileViewer /></Suspense>
}

function FileViewer() {
  const searchParams = useSearchParams()
  const fileId = searchParams.get('fileId') || ''
  const name = searchParams.get('name') || ''
  const school = searchParams.get('school')
  const [kind, setKind] = useState<Kind | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any

  const isLandscape = rotation % 180 !== 0
  const isDriveFile = !!fileId && !fileId.includes('/')

  // 下載檔案並判斷類型
  useEffect(() => {
    const id = fileId
    if (name) document.title = `${name}｜檔案檢視`
    if (!id) return

    let objectUrl = ''
    let cancelled = false
    ;(async () => {
      try {
        const qs = new URLSearchParams({ fileId: id, ...(school ? { school } : {}) })
        const res = await fetch(`/api/admin/file-proxy?${qs}`)
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error || `檔案讀取失敗（HTTP ${res.status}）`)
        }
        const blob = await res.blob()
        const k = await detectKind(blob)
        if (cancelled) return
        if (k === 'pdf') {
          await loadPdfJs()
          const pdf = await window.pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise
          if (cancelled) return
          pdfDocRef.current = pdf
          setTotalPages(pdf.numPages)
        } else if (k === 'image') {
          objectUrl = URL.createObjectURL(blob)
          setImageUrl(objectUrl)
        }
        setKind(k)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '檔案讀取失敗')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [fileId, name, school])

  // 渲染 PDF 目前頁面
  useEffect(() => {
    if (kind !== 'pdf' || !pdfDocRef.current) return
    let cancelled = false
    ;(async () => {
      const pdfPage = await pdfDocRef.current.getPage(page)
      if (cancelled) return
      const canvas = canvasRef.current; const container = containerRef.current
      if (!canvas || !container) return
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation })
      const fitScale = Math.min((container.clientWidth - 32) / baseViewport.width, (container.clientHeight - 96) / baseViewport.height)
      const viewport = pdfPage.getViewport({ scale: Math.max(fitScale, 0.1) * zoom, rotation })
      const dpr = window.devicePixelRatio || 1
      canvas.width = viewport.width * dpr; canvas.height = viewport.height * dpr
      canvas.style.width = viewport.width + 'px'; canvas.style.height = viewport.height + 'px'
      const ctx = canvas.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      await pdfPage.render({ canvasContext: ctx, viewport }).promise
    })()
    return () => { cancelled = true }
  }, [kind, page, rotation, zoom])

  // 鍵盤快捷鍵：← → 換頁、R 旋轉、+ - 縮放
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPage(p => Math.min(totalPages || 1, p + 1))
      else if (e.key === 'ArrowLeft') setPage(p => Math.max(1, p - 1))
      else if (e.key === 'r' || e.key === 'R') setRotation(r => (r + 90) % 360)
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))
      else if (e.key === '-') setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [totalPages])

  if (!fileId) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">缺少檔案參數</div>

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#1a1a24' }}>
      {/* 頂部 */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 shrink-0"
        style={{ background: 'rgba(25,25,35,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-white/70 text-sm font-medium truncate">{name || '檔案檢視'}</span>
        {isDriveFile && (
          <ToolbarBtn variant="blue" onClick={() => window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank')} title="在 Google Drive 開啟">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            在 Google Drive 開啟
          </ToolbarBtn>
        )}
      </div>

      {/* 內容區 */}
      <div ref={containerRef} className="flex-1 relative overflow-auto">
        {loading && <div className="text-white/70 text-sm text-center mt-16">檔案載入中…</div>}
        {error && <div className="text-red-300 text-sm text-center mt-16 px-6">{error}</div>}
        {!loading && kind === 'other' && (
          <div className="text-white/70 text-sm text-center mt-16 px-6">此檔案格式無法在這裡預覽{isDriveFile ? '，請改用右上角「在 Google Drive 開啟」。' : '。'}</div>
        )}
        {kind === 'pdf' && (
          <div className="min-h-full flex items-start justify-center py-4 pb-24">
            <canvas ref={canvasRef} className="shadow-lg bg-white" />
          </div>
        )}
        {kind === 'image' && imageUrl && (
          <div className="min-h-full flex items-center justify-center p-4 pb-24">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={name || '上傳檔案'}
              style={{
                maxWidth: isLandscape ? 'calc(100vh - 140px)' : '100%',
                maxHeight: isLandscape ? '100vw' : 'calc(100vh - 140px)',
                objectFit: 'contain',
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                transition: 'transform 0.25s ease',
              }} />
          </div>
        )}

        {/* 底部懸浮工具列 */}
        {!loading && !error && (kind === 'pdf' || kind === 'image') && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm"
            style={{ background: 'rgba(20,20,30,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            <ToolbarBtn onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="縮小（-）">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </ToolbarBtn>
            <button onClick={() => setZoom(1)} title="恢復原始大小" className="w-12 text-center text-white/70 text-xs tabular-nums cursor-pointer hover:text-white">{Math.round(zoom * 100)}%</button>
            <ToolbarBtn onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} title="放大（+）">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </ToolbarBtn>
            {kind === 'pdf' && totalPages > 1 && <>
              <div className="w-px h-5 bg-white/15" />
              <ToolbarBtn onClick={() => setPage(p => Math.max(1, p - 1))} title="上一頁（←）">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
              </ToolbarBtn>
              <span className="text-white/70 text-xs tabular-nums px-1">{page} / {totalPages}</span>
              <ToolbarBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} title="下一頁（→）">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
              </ToolbarBtn>
            </>}
            <div className="w-px h-5 bg-white/15" />
            <ToolbarBtn onClick={() => setRotation(r => (r - 90 + 360) % 360)} title="向左旋轉">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
            </ToolbarBtn>
            <ToolbarBtn onClick={() => setRotation(r => (r + 90) % 360)} title="向右旋轉（R）">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
            </ToolbarBtn>
          </div>
        )}
      </div>
    </div>
  )
}
