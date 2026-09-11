'use client'
import React, { useState, useEffect, useRef } from 'react'

declare global {
  interface Window { pdfjsLib: any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'])

function ToolbarBtn({ onClick, title, children, variant = 'default' }: {
  onClick?: () => void; title?: string; children: React.ReactNode
  variant?: 'default' | 'blue' | 'red'
}) {
  const base = 'inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium transition-colors px-3 py-1.5 select-none cursor-pointer'
  const colors = { default: 'bg-white/10 hover:bg-white/20 text-white', blue: 'bg-blue-500/80 hover:bg-blue-500 text-white', red: 'bg-red-500/80 hover:bg-red-500 text-white' }
  return <button onClick={onClick} title={title} className={`${base} ${colors[variant]}`}>{children}</button>
}

export default function FileViewerPage() {
  const [fileId, setFileId] = useState('')
  const [fileExt, setFileExt] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [zoom, setZoom] = useState(1.0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any

  const isImage = fileExt ? IMAGE_EXTS.has(fileExt.toLowerCase()) : false
  const showAsImage = isImage && !imgError
  const isLandscape = rotation % 180 !== 0

  // 從 URL 讀取參數
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('fileId') || ''
    const ext = params.get('fileExt') || null
    setFileId(id)
    setFileExt(ext)
  }, [])

  // 載入 PDF.js
  useEffect(() => {
    if (!fileId || showAsImage) return
    if (window.pdfjsLib) return
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
    script.type = 'module'
    script.onload = () => {
      if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'
    }
    document.head.appendChild(script)
  }, [fileId, showAsImage])

  // 載入 PDF 文件
  useEffect(() => {
    if (!fileId || showAsImage) { if (fileId) setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      let tries = 0
      while (!window.pdfjsLib && tries < 50) { await new Promise(r => setTimeout(r, 100)); tries++ }
      if (!window.pdfjsLib) { setError('PDF.js 載入逾時'); setLoading(false); return }
      try {
        const pdf = await window.pdfjsLib.getDocument(`/api/admin/file-proxy?fileId=${encodeURIComponent(fileId)}`).promise
        if (cancelled) return
        pdfDocRef.current = pdf; setTotalPages(pdf.numPages); setPage(1)
      } catch (e) { if (!cancelled) setError('PDF 載入失敗：' + String(e)) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [fileId, showAsImage])

  // 渲染 PDF canvas
  useEffect(() => {
    if (!pdfDocRef.current || loading || showAsImage) return
    let cancelled = false
    async function render() {
      const pdfPage = await pdfDocRef.current.getPage(page)
      if (cancelled) return
      const canvas = canvasRef.current; const container = containerRef.current
      if (!canvas || !container) return
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation })
      const fitScale = Math.min((container.clientWidth || 800) / baseViewport.width, (container.clientHeight || 600) / baseViewport.height)
      const viewport = pdfPage.getViewport({ scale: fitScale * zoom, rotation })
      const dpr = window.devicePixelRatio || 1
      canvas.width = viewport.width * dpr; canvas.height = viewport.height * dpr
      canvas.style.width = viewport.width + 'px'; canvas.style.height = viewport.height + 'px'
      const ctx = canvas.getContext('2d')!; ctx.scale(dpr, dpr)
      await pdfPage.render({ canvasContext: ctx, viewport }).promise
    }
    render()
    return () => { cancelled = true }
  }, [pdfDocRef.current, page, rotation, zoom, loading, showAsImage]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!fileId) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">缺少檔案參數</div>

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#1a1a24' }}>
      {/* 頂部 */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: 'rgba(25,25,35,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-white/60 text-sm font-medium">📄 檔案預覽</span>
        <ToolbarBtn variant="blue" onClick={() => window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank')} title="在 Google Drive 開啟">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          另開 Google Drive
        </ToolbarBtn>
      </div>

      {/* 內容區 */}
      <div className="flex-1 relative overflow-hidden">
        {showAsImage ? (
          <div className="w-full h-full flex items-center justify-center overflow-auto">
            <img
              src={`https://lh3.googleusercontent.com/d/${fileId}`}
              alt="檔案預覽"
              onError={() => setImgError(true)}
              style={{
                maxWidth: isLandscape ? 'calc(100vh - 100px)' : '100%',
                maxHeight: isLandscape ? '100vw' : 'calc(100vh - 100px)',
                objectFit: 'contain',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s ease',
                transformOrigin: 'center center',
              }}
            />
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full overflow-auto flex items-start justify-center">
            {loading && <div className="text-white mt-8">載入中…</div>}
            {error && <div className="text-red-400 mt-8">{error}</div>}
            {!loading && !error && <canvas ref={canvasRef} className="mt-4 mb-20 shadow-lg" />}
          </div>
        )}

        {/* 底部懸浮工具列 */}
        {(!loading || showAsImage) && !error && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm"
            style={{ background: 'rgba(20,20,30,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            {/* PDF 縮放 + 換頁 */}
            {!showAsImage && <>
              <ToolbarBtn onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="縮小">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </ToolbarBtn>
              <span className="w-11 text-center text-white/70 text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
              <ToolbarBtn onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} title="放大">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </ToolbarBtn>
              {totalPages > 1 && <>
                <div className="w-px h-5 bg-white/15" />
                <ToolbarBtn onClick={() => setPage(p => Math.max(1, p - 1))} title="上一頁">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </ToolbarBtn>
                <span className="text-white/70 text-xs tabular-nums px-1">{page} / {totalPages}</span>
                <ToolbarBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} title="下一頁">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </ToolbarBtn>
              </>}
              <div className="w-px h-5 bg-white/15" />
            </>}
            {/* 旋轉 */}
            <ToolbarBtn onClick={() => setRotation(r => (r - 90 + 360) % 360)} title="向左旋轉">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </ToolbarBtn>
            <ToolbarBtn onClick={() => setRotation(r => (r + 90) % 360)} title="向右旋轉">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
              </svg>
            </ToolbarBtn>
          </div>
        )}
      </div>
    </div>
  )
}
