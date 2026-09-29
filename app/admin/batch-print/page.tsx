'use client'
import React, { useEffect, useState, useRef } from 'react'

declare global {
  interface Window { pdfjsLib: any } // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface Item {
  school_id: number
  code: number
  name: string
  path: string
}

interface RenderedItem extends Item {
  status: 'pending' | 'loading' | 'done' | 'error'
  pages: string[]   // PDF：每頁一張 dataURL
  imageUrl?: string // 圖片檔：單張 objectURL
  error?: string
}

function fileUrl(path: string) {
  if (!path.includes('/')) return `/api/admin/file-proxy?fileId=${encodeURIComponent(path)}`
  return `/api/admin/file?path=${encodeURIComponent(path)}`
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
    script.onerror = () => reject(new Error('PDF.js 載入失敗'))
    document.head.appendChild(script)
  })
}

export default function BatchPrintPage() {
  const [items, setItems] = useState<RenderedItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [typeLabel, setTypeLabel] = useState('')
  const [semLabel, setSemLabel] = useState('')
  const [mergeUrl, setMergeUrl] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeError, setMergeError] = useState('')
  const printedRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type') === 'remittance' ? 'remittance' : 'scan'
    const semester = params.get('semester') || '1'
    const planId = params.get('plan_id') || ''
    const schoolYear = params.get('school_year') || ''

    setTypeLabel(type === 'scan' ? '經費收支結算表' : '賸餘款送款憑單')
    setSemLabel(`第${semester}學期`)
    setMergeUrl(`/api/admin/batch-print-merge?${new URLSearchParams({ type, semester, ...(planId ? { plan_id: planId } : {}), ...(schoolYear ? { school_year: schoolYear } : {}) })}`)

    const qs = new URLSearchParams({ type, semester, ...(planId ? { plan_id: planId } : {}), ...(schoolYear ? { school_year: schoolYear } : {}) })
    fetch(`/api/admin/batch-print-list?${qs}`).then(r => r.json()).then(data => {
      if (data.error) { setListError(data.error); setListLoading(false); return }
      const list: Item[] = data.list || []
      setItems(list.map(it => ({ ...it, status: 'pending', pages: [] })))
      setListLoading(false)
    }).catch(() => { setListError('讀取清單失敗'); setListLoading(false) })
  }, [])

  // 依序載入每一份檔案（避免同時大量渲染造成瀏覽器卡頓）
  useEffect(() => {
    if (listLoading || items.length === 0) return
    let cancelled = false

    async function processAll() {
      await loadPdfJs().catch(() => {})
      for (let i = 0; i < items.length; i++) {
        if (cancelled) return
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'loading' } : it))
        try {
          const res = await fetch(fileUrl(items[i].path))
          if (!res.ok) throw new Error('下載失敗')
          const blob = await res.blob()
          if (blob.type === 'application/pdf') {
            const buf = await blob.arrayBuffer()
            const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise
            const pages: string[] = []
            for (let p = 1; p <= pdf.numPages; p++) {
              const page = await pdf.getPage(p)
              const viewport = page.getViewport({ scale: 2 })
              const canvas = document.createElement('canvas')
              canvas.width = viewport.width
              canvas.height = viewport.height
              const ctx = canvas.getContext('2d')!
              await page.render({ canvasContext: ctx, viewport }).promise
              pages.push(canvas.toDataURL('image/jpeg', 0.92))
            }
            if (cancelled) return
            setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'done', pages } : it))
          } else {
            const objectUrl = URL.createObjectURL(blob)
            if (cancelled) return
            setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'done', imageUrl: objectUrl } : it))
          }
        } catch (e) {
          if (cancelled) return
          setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'error', error: e instanceof Error ? e.message : String(e) } : it))
        }
      }
    }
    processAll()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLoading])

  const doneCount = items.filter(it => it.status === 'done' || it.status === 'error').length
  const allDone = items.length > 0 && doneCount === items.length

  useEffect(() => {
    if (allDone && !printedRef.current) {
      printedRef.current = true
      setTimeout(() => window.print(), 300)
    }
  }, [allDone])

  async function downloadMerged() {
    setMerging(true); setMergeError('')
    try {
      const res = await fetch(mergeUrl)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || '合併失敗')
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename\*=UTF-8''([^;]+)/)
      a.download = match ? decodeURIComponent(match[1]) : '批次列印.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
      const errCount = Number(res.headers.get('X-Merge-Errors') || '0')
      if (errCount > 0) setMergeError(`已下載，但有 ${errCount} 校檔案無法自動合併（PDF 內會附上說明頁）`)
    } catch (e) {
      setMergeError(e instanceof Error ? e.message : '合併失敗')
    }
    setMerging(false)
  }

  return (
    <div className="p-6">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          .no-print { display: none !important; }
        }
        .school-block { page-break-before: always; }
        .school-block:first-of-type { page-break-before: auto; }
        .page-img { width: 100%; display: block; margin-bottom: 4mm; }
      `}</style>

      <div className="no-print mb-4 flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
        <div>
          <p className="font-medium">批次列印：{typeLabel}（{semLabel}）</p>
          <p className="text-xs mt-1">
            {listLoading ? '讀取學校清單中…' : items.length === 0 ? '沒有已核准的檔案可列印' : `共 ${items.length} 校，已處理 ${doneCount}/${items.length}`}
          </p>
          {mergeError && <p className="text-xs mt-1 text-orange-700">{mergeError}</p>}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button onClick={downloadMerged} disabled={merging}
              className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs cursor-pointer">
              {merging ? '合併中…' : '📥 下載合併 PDF'}
            </button>
          )}
          {allDone && items.length > 0 && (
            <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-blue-700 cursor-pointer">
              重新列印
            </button>
          )}
        </div>
      </div>

      {listError && <p className="text-red-600 text-sm">{listError}</p>}

      {items.map((it, i) => (
        <div key={it.school_id} className="school-block">
          <div className="no-print text-xs text-gray-400 mb-1">
            {String(it.code).padStart(3, '0')}　{it.name}
            {it.status === 'loading' && '　載入中…'}
            {it.status === 'error' && `　❌ 載入失敗：${it.error}`}
          </div>
          {it.status === 'done' && it.imageUrl && (
            <img src={it.imageUrl} className="page-img" alt={it.name} />
          )}
          {it.status === 'done' && it.pages.map((src, p) => (
            <img key={p} src={src} className="page-img" alt={`${it.name} p${p + 1}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
