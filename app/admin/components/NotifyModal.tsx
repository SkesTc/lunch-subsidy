'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { MailIcon } from '@/components/icons'
import {
  CONDITION_LABELS, NOTIFY_VARIABLES, findCollectionTemplate, listCollectionTemplates, updateCollectionTemplate,
  type CollectionTemplate, type NotifyCondition,
} from '@/lib/notifyTemplates'
import type { PlanStatus } from '@/lib/planStatus'

export interface NotifyTarget {
  id: number
  code: number
  name: string
  bound: boolean
  hasExpense: boolean
  scanUploaded: boolean
  remitUploaded: boolean
  repayAmount: number
}

// 依範本的適用對象判斷學校是否需要被催收
function matches(target: NotifyCondition, t: NotifyTarget, remitApplies: boolean) {
  if (target === 'expense') return !t.hasExpense
  if (target === 'scan') return !t.scanUploaded
  if (target === 'remittance') return remitApplies && t.repayAmount > 0 && !t.remitUploaded
  return true
}

export function NotifyModal({ targets, semester, planId, planStatus, remitApplies, onClose, onNarrow, onSent }: {
  targets: NotifyTarget[]
  semester: number
  planId: string | null
  planStatus?: PlanStatus | null
  remitApplies: boolean
  onClose: () => void
  onNarrow: (ids: number[]) => void
  onSent: (successCount: number, total: number) => void
}) {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)
  const [templateKey, setTemplateKey] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ to: string[]; subject: string; html: string } | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const initialized = useRef(false)

  const templates = useMemo(() => (settings ? listCollectionTemplates(settings) : []), [settings])
  const current = templates.find(t => t.key === templateKey)
  const target: NotifyCondition = current?.target || 'all'

  const countFor = (tpl: CollectionTemplate) => targets.filter(t => matches(tpl.target, t, remitApplies)).length
  const matched = targets.filter(t => matches(target, t, remitApplies))
  const mismatched = targets.filter(t => !matches(target, t, remitApplies))
  const unbound = targets.filter(t => !t.bound)
  const sendable = targets.filter(t => t.bound)

  function applyTemplate(tpl: CollectionTemplate) {
    setTemplateKey(tpl.key); setSubject(tpl.subject); setBody(tpl.body); setSaveMsg('')
    const first = targets.find(t => t.bound && matches(tpl.target, t, remitApplies)) || targets.find(t => t.bound)
    setPreviewId(first?.id ?? null)
  }

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      const s = d && !d.error ? d : {}
      setSettings(s)
      if (initialized.current) return
      initialized.current = true
      // 預設選「有特定適用對象、且符合學校最多」的範本；都不符合時用第一個通用範本
      const list = listCollectionTemplates(s)
      const counts = list.map(tpl => ({ tpl, n: targets.filter(t => matches(tpl.target, t, remitApplies)).length }))
      const best = counts.filter(c => c.tpl.target !== 'all' && c.n > 0).sort((a, b) => b.n - a.n)[0]?.tpl
        || list.find(t => t.target === 'all') || list[0]
      if (best) applyTemplate(best)
    }).catch(() => setSettings({}))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 從「編輯範本」分頁回來時重新讀取；若內容沒有手動改過，自動換成新範本
  useEffect(() => {
    async function onFocus() {
      if (!settings || !templateKey) return
      const d = await fetch('/api/admin/settings').then(r => r.json()).catch(() => null)
      if (!d || d.error) return
      const before = findCollectionTemplate(settings, templateKey)
      const after = findCollectionTemplate(d, templateKey)
      setSettings(d)
      if (before && after && before.subject === subject && before.body === body && (after.subject !== subject || after.body !== body)) {
        setSubject(after.subject); setBody(after.body); setSaveMsg('已載入更新後的範本')
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [settings, templateKey, subject, body])

  // 內容變動後 0.4 秒更新預覽
  useEffect(() => {
    if (previewId === null || !subject) return
    const t = setTimeout(async () => {
      setPreviewLoading(true); setPreviewError('')
      try {
        const r = await fetch('/api/admin/notify/preview', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId: previewId, subject, message: body, semester, planId }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `預覽失敗（HTTP ${r.status}）`)
        setPreview(d)
      } catch (e) {
        setPreview(null); setPreviewError(e instanceof Error ? e.message : '預覽失敗')
      }
      setPreviewLoading(false)
    }, 400)
    return () => clearTimeout(t)
  }, [previewId, subject, body, semester, planId])

  async function saveAsDefault() {
    if (!settings || !current) return
    setSaveMsg('')
    const update = updateCollectionTemplate(settings, current.key, { subject, body })
    const r = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) })
    if (r.ok) { setSettings({ ...settings, ...update }); setSaveMsg('已存為此範本的內容') }
    else setSaveMsg(r.status === 403 ? '僅超級管理員可修改範本' : '儲存失敗')
  }

  async function send() {
    setSending(true); setError('')
    try {
      const r = await fetch('/api/admin/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolIds: targets.map(t => t.id), subject, message: body, semester, planId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || `寄送失敗（HTTP ${r.status}）`)
      onSent(d.successCount, d.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : '寄送失敗')
    }
    setSending(false)
  }

  const shown = previewId !== null ? preview : null
  const isUnchanged = !!current && current.subject === subject && current.body === body
  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500'

  const renderTemplateButton = (tpl: CollectionTemplate) => {
    const active = tpl.key === templateKey
    return (
      <button key={tpl.key} onClick={() => applyTemplate(tpl)}
        className={`text-left rounded-xl border px-3 py-2 cursor-pointer transition-colors ${active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
        <span className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium truncate ${active ? 'text-blue-700' : 'text-gray-800'}`}>{tpl.label}</span>
          <span className="text-xs tabular-nums text-gray-500 shrink-0">{countFor(tpl)}/{targets.length}</span>
        </span>
        <span className="block text-xs text-gray-400 mt-0.5 truncate">{CONDITION_LABELS[tpl.target]}</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="notify-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 id="notify-title" className="text-lg font-bold text-gray-800">寄送催收通知</h2>
          <button onClick={onClose} aria-label="關閉" className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer">×</button>
        </div>

        {settings === null ? (
          <div className="p-10 flex justify-center text-gray-400"><Spinner /></div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 p-6 overflow-y-auto min-h-0">
            {/* 左：範本與內容 */}
            <div className="space-y-4 min-w-0">
              {planStatus && planStatus !== 'open' && (
                <div role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
                  {planStatus === 'closed'
                    ? '此計畫已結案，學校目前無法填報或上傳。若要請學校補件，請先到「核銷計畫管理」將計畫改回「已開放」。'
                    : '此計畫尚未開放送件，學校目前無法填報或上傳。若要請學校開始作業，請先到「核銷計畫管理」將計畫設為「已開放」。'}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">選擇範本</p>
                  <a href="/admin?tab=schools&sub=notify" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline">管理範本 ↗</a>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  <div className="grid grid-cols-2 gap-2">{templates.filter(t => t.builtIn).map(renderTemplateButton)}</div>
                  {templates.some(t => !t.builtIn) && (
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-gray-400 mb-1.5">自訂範本</p>
                      <div className="grid grid-cols-2 gap-2">{templates.filter(t => !t.builtIn).map(renderTemplateButton)}</div>
                    </div>
                  )}
                </div>
              </div>

              {(mismatched.length > 0 || unbound.length > 0) && (
                <div className="space-y-2">
                  {mismatched.length > 0 && target !== 'all' && (
                    <div className="flex flex-wrap items-center gap-2 text-sm bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
                      <span className="flex-1 min-w-0">
                        有 {mismatched.length} 校不屬於「{current?.label}」的適用對象：
                        {mismatched.slice(0, 3).map(t => t.name).join('、')}{mismatched.length > 3 ? ' 等' : ''}
                      </span>
                      {matched.length > 0 && (
                        <button onClick={() => onNarrow(matched.map(t => t.id))}
                          className="shrink-0 text-xs font-medium bg-white border border-amber-300 rounded-lg px-2.5 py-1 hover:bg-amber-100 cursor-pointer">
                          只寄給符合的 {matched.length} 校
                        </button>
                      )}
                    </div>
                  )}
                  {unbound.length > 0 && (
                    <p className="text-sm bg-gray-50 text-gray-600 rounded-lg px-3 py-2">
                      {unbound.length} 校尚未綁定帳號，收不到通知：{unbound.slice(0, 3).map(t => t.name).join('、')}{unbound.length > 3 ? ' 等' : ''}
                    </p>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="notify-subject" className="block text-sm font-medium text-gray-700">主旨</label>
                  {current && (
                    <a href={`/admin?tab=schools&sub=notify&scenario=${encodeURIComponent(current.key)}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline">編輯「{current.label}」範本 ↗</a>
                  )}
                </div>
                <input id="notify-subject" value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="notify-body" className="block text-sm font-medium text-gray-700 mb-1">內容</label>
                <textarea id="notify-body" value={body} onChange={e => setBody(e.target.value)} rows={11} className={`${inputCls} resize-y`} />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {current && !isUnchanged && (
                  <>
                    <button onClick={() => applyTemplate(current)} className="text-gray-500 hover:text-gray-800 underline cursor-pointer">還原為範本內容</button>
                    <button onClick={saveAsDefault} className="text-blue-600 hover:text-blue-800 underline cursor-pointer">把修改存回「{current.label}」範本</button>
                  </>
                )}
                {saveMsg && <span className={saveMsg.startsWith('已') ? 'text-green-600' : 'text-red-600'}>{saveMsg}</span>}
              </div>
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer select-none">可用變數</summary>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  {NOTIFY_VARIABLES.map(([v, desc]) => (
                    <div key={v} className="flex gap-2"><code className="text-blue-700 bg-blue-50 px-1 rounded shrink-0">{v}</code><span>{desc}</span></div>
                  ))}
                </div>
              </details>
            </div>

            {/* 右：預覽 */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-700">預覽</p>
                <select value={previewId ?? ''} onChange={e => setPreviewId(e.target.value ? Number(e.target.value) : null)}
                  aria-label="預覽收件學校" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[60%] outline-none focus:ring-2 focus:ring-blue-500">
                  {sendable.map(t => <option key={t.id} value={t.id}>{String(t.code).padStart(3, '0')} {t.name}</option>)}
                </select>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-sm space-y-0.5">
                  <p className="text-gray-500 truncate">收件者：{shown?.to.join('、') || '—'}</p>
                  <p className="font-medium text-gray-800 break-words">{shown?.subject || subject}</p>
                </div>
                <div className="relative bg-slate-100">
                  {previewLoading && <div className="absolute top-2 right-2 text-gray-400"><Spinner size="xs" /></div>}
                  {previewError ? (
                    <p className="p-6 text-sm text-red-600">{previewError}</p>
                  ) : sendable.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">勾選的學校都尚未綁定帳號，無法預覽。</p>
                  ) : (
                    <iframe title="信件預覽" sandbox="" srcDoc={shown?.html || ''} className="w-full h-[480px] bg-white" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-t border-gray-100">
          <p className="text-sm text-gray-600 flex-1 min-w-0">
            將寄給 <b>{sendable.length}</b> 校的綁定帳號{unbound.length > 0 ? `（${unbound.length} 校未綁定，略過）` : ''}
          </p>
          {error && <p className="text-sm text-red-600 w-full order-first">{error}</p>}
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">取消</button>
          <button onClick={send} disabled={sending || sendable.length === 0 || !subject.trim() || !body.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            {sending ? <Spinner size="xs" /> : <MailIcon />}{sending ? '寄送中…' : `寄出（${sendable.length} 校）`}
          </button>
        </div>
      </div>
    </div>
  )
}
