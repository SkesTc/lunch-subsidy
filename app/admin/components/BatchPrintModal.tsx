'use client'
import { useState, useEffect, useRef } from 'react'
import { Spinner } from '@/components/Spinner'

type BatchPart = { status: 'pending' | 'running' | 'done' | 'error'; url?: string; filename?: string; note?: string; pct?: number; label?: string }

const batchDownloadUrl = (fileId: string) => `https://drive.google.com/uc?export=download&id=${fileId}`

export function BatchPrintModal({ type, semester, planId, schoolYear, onClose }: {
  type: 'scan' | 'remittance'; semester: number; planId: string | null; schoolYear: string; onClose: () => void
}) {
  const [total, setTotal] = useState<number | null>(null)
  const [parts, setParts] = useState<BatchPart[]>([])
  const [error, setError] = useState('')
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [running, setRunning] = useState(true)
  const startedRef = useRef(false)
  const cancelledRef = useRef(false)
  const baseRef = useRef<URLSearchParams | null>(null)
  const typeLabel = type === 'scan' ? '經費收支結算表' : '賸餘款送款憑單'

  function updatePart(i: number, patch: Partial<BatchPart>) {
    setParts(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p))
  }

  async function generate(n: number) {
    cancelledRef.current = false
    setRunning(true); setGeneratedAt(null); setStale(false)
    const count = Math.ceil(n / 50)
    setParts(Array.from({ length: count }, () => ({ status: 'pending' as const })))
    let okCount = 0
    for (let i = 0; i < count; i++) {
      if (cancelledRef.current) return
      updatePart(i, { status: 'running' })
      try {
        const res = await fetch(`/api/admin/batch-print-merge?${baseRef.current}&part=${i + 1}`)
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `合併失敗（HTTP ${res.status}）`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let final: { fileId: string; filename: string; errors?: string[] } | null = null
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let nl
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            if (!line) continue
            const msg = JSON.parse(line)
            if (msg.type === 'progress') updatePart(i, { pct: msg.pct, label: msg.label })
            else if (msg.type === 'error') throw new Error(msg.error)
            else if (msg.type === 'done') final = msg
          }
        }
        if (!final) throw new Error('合併中斷（伺服器未回傳結果，可能逾時）')
        okCount++
        updatePart(i, {
          status: 'done', url: batchDownloadUrl(final.fileId), filename: final.filename,
          note: final.errors?.length ? `有 ${final.errors.length} 校無法自動合併（PDF 內附說明頁）：${final.errors.slice(0, 3).join('；')}` : undefined,
        })
      } catch (e) {
        updatePart(i, { status: 'error', note: e instanceof Error ? e.message : '合併失敗' })
      }
    }
    if (okCount === count) setGeneratedAt(new Date().toISOString())
    setRunning(false)
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    async function init() {
      const base = new URLSearchParams({ type, semester: String(semester), school_year: schoolYear, ...(planId ? { plan_id: planId } : {}) })
      baseRef.current = base
      try {
        const [lr, sr] = await Promise.all([
          fetch(`/api/admin/batch-print-list?${base}`),
          fetch(`/api/admin/batch-merge-status?${base}`),
        ])
        const d = await lr.json().catch(() => ({}))
        if (!lr.ok) throw new Error(d.error || `讀取清單失敗（HTTP ${lr.status}）`)
        const n = (d.list || []).length
        if (n === 0) { setError('沒有已核准的檔案可合併'); setRunning(false); return }
        setTotal(n)
        const st = await sr.json().catch(() => ({}))
        if (st.record && st.complete) {
          const rec = st.record
          setParts(Array.from({ length: rec.partCount }, (_, i) => {
            const p = rec.parts[String(i + 1)]
            return {
              status: 'done' as const, url: batchDownloadUrl(p.fileId), filename: p.filename,
              note: p.errors?.length ? `有 ${p.errors.length} 校無法自動合併（PDF 內附說明頁）：${p.errors.slice(0, 3).join('；')}` : undefined,
            }
          }))
          setGeneratedAt(rec.generatedAt)
          setStale(rec.total !== n)
          setRunning(false)
          return
        }
        await generate(n)
      } catch (e) {
        setError(e instanceof Error ? e.message : '發生錯誤')
        setRunning(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function close() { cancelledRef.current = true; onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-800">批次合併：{typeLabel}（第{semester}學期）</h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl leading-none cursor-pointer">×</button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : total === null ? (
          <p className="text-sm text-gray-500 flex items-center gap-2"><Spinner size="xs" /> 讀取學校清單中…</p>
        ) : (
          <>
            {generatedAt ? (
              <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                ✅ 已於 {new Date(generatedAt).toLocaleString('zh-TW')} 合併完成，共 {total} 校
                {stale && <span className="block text-orange-600 mt-0.5">目前已核准的學校數與當時不同，資料可能已更新，建議重新合併。</span>}
              </div>
            ) : (
              <p className="text-xs text-gray-500">共 {total} 校，依學校編號排序，每 50 校合併成一份 PDF。合併需要一些時間，請保持此視窗開啟。</p>
            )}
            <div className="space-y-2">
              {parts.map((p, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">
                      第 {i + 1} 份（第 {i * 50 + 1}–{Math.min((i + 1) * 50, total)} 校）
                    </span>
                    {p.status === 'pending' && <span className="text-xs text-gray-400">等待中</span>}
                    {p.status === 'running' && <span className="text-xs text-blue-600 tabular-nums">{p.pct ?? 0}%</span>}
                    {p.status === 'error' && <span className="text-xs text-red-600">失敗</span>}
                    {p.status === 'done' && (
                      <a href={p.url} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg">📥 下載</a>
                    )}
                  </div>
                  {p.status === 'running' && (
                    <>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${p.pct ?? 0}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">{p.label || '準備中…'}</p>
                    </>
                  )}
                  {p.filename && <p className="text-xs text-gray-400 break-all">{p.filename}</p>}
                  {p.note && <p className={`text-xs break-all ${p.status === 'error' ? 'text-red-600' : 'text-orange-600'}`}>{p.note}</p>}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-between gap-3">
          {total !== null && !running && !error ? (
            <button onClick={() => generate(total)}
              className="px-4 py-2 rounded-lg text-sm bg-orange-600 hover:bg-orange-700 text-white cursor-pointer">🔄 重新合併</button>
          ) : <span />}
          <button onClick={close} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
            {running ? '取消並關閉' : '關閉'}
          </button>
        </div>
      </div>
    </div>
  )
}
