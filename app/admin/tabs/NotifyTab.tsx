'use client'
import { useState, useEffect, useRef } from 'react'
import { Spinner, BlockSpinner } from '@/components/Spinner'
import { useDialog } from '@/components/DialogProvider'
import { EmailPreview, SAMPLE_VARS } from '@/components/EmailPreview'
import { TrashIcon } from '@/components/icons'
import {
  CONDITION_LABELS, GENERAL_TEMPLATE_DEFAULT, NOTIFY_VARIABLES, REVIEW_DEFAULTS, REVIEW_VARIABLES,
  findCollectionTemplate, getCustomTemplates, listCollectionTemplates, parseSavedTemplates, updateCollectionTemplate,
  type NotifyCondition,
} from '@/lib/notifyTemplates'

type Settings = Record<string, string>
type ReviewKind = 'approve' | 'reject'

// 範本頁會修改的設定欄位（判斷是否有未儲存的變更、以及儲存時送出的內容）
const TEMPLATE_KEYS = [
  'notify_templates', 'notify_custom_templates',
  'review_approve_subject', 'review_approve_body', 'review_reject_subject', 'review_reject_body',
]
const pick = (s: Settings) => JSON.stringify(TEMPLATE_KEYS.map(k => s[k] ?? ''))

const REVIEW_LABELS: Record<ReviewKind, string> = { approve: '審核通過', reject: '審核拒絕' }
const REVIEW_SAMPLE: Record<ReviewKind, Record<string, string>> = {
  approve: { ...SAMPLE_VARS, semLabel: '開學加碼（第1學期）', actionNote: '新上傳的檔案已生效，如有疑問請聯絡承辦人員。', adminNote: '承辦備註：請於本週內完成補件\n\n' },
  reject: { ...SAMPLE_VARS, semLabel: '開學加碼（第1學期）', actionNote: '', adminNote: '退回原因：掃描檔缺少校長核章\n\n' },
}

export default function NotifyTab({ isSuperAdmin, initialTemplateKey }: { isSuperAdmin?: boolean; initialTemplateKey?: string }) {
  const dialog = useDialog()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [snapshot, setSnapshot] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  // 目前編輯的範本：催收範本用其 key，審核通知用 review:approve / review:reject
  const [selected, setSelected] = useState(initialTemplateKey || 'expense')
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<'subject' | 'body'>('body')
  const readOnly = isSuperAdmin === false

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(data => {
      if (!data.error) { setSettings(data); setSnapshot(pick(data)) }
      setLoading(false)
    })
  }, [])

  if (loading) return <BlockSpinner />
  if (!settings) return <div className="text-center py-8 text-red-400">讀取設定失敗，請重新整理</div>

  const collection = listCollectionTemplates(settings)
  const isReview = selected.startsWith('review:')
  const reviewKind = (isReview ? selected.slice(7) : 'approve') as ReviewKind
  const tpl = isReview ? null : (findCollectionTemplate(settings, selected) || collection[0])
  const subject = isReview ? (settings[`review_${reviewKind}_subject`] || REVIEW_DEFAULTS[reviewKind].subject) : tpl!.subject
  const body = isReview ? (settings[`review_${reviewKind}_body`] || REVIEW_DEFAULTS[reviewKind].body) : tpl!.body
  const variables = isReview ? REVIEW_VARIABLES : NOTIFY_VARIABLES
  const dirty = pick(settings) !== snapshot

  function merge(patch: Record<string, string>) {
    setSettings(prev => (prev ? { ...prev, ...patch } : prev))
    setMessage(null)
  }

  function setField(field: 'subject' | 'body', value: string) {
    if (isReview) merge({ [`review_${reviewKind}_${field}`]: value })
    else merge(updateCollectionTemplate(settings!, tpl!.key, { [field]: value }))
  }

  function setCustomMeta(patch: { label?: string; target?: NotifyCondition }) {
    if (tpl && !tpl.builtIn) merge(updateCollectionTemplate(settings!, tpl.key, patch))
  }

  // 點變數標籤：插入到最後一次聚焦欄位的游標位置
  function insertVariable(v: string) {
    if (readOnly) return
    const el = lastFocused.current === 'subject' ? subjectRef.current : bodyRef.current
    const field = lastFocused.current
    const value = field === 'subject' ? subject : body
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    setField(field, value.slice(0, start) + v + value.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + v.length, start + v.length)
    })
  }

  function addCustom() {
    const id = Date.now().toString(36)
    const list = [...getCustomTemplates(settings!), { id, label: '新的自訂範本', target: 'all' as NotifyCondition, ...GENERAL_TEMPLATE_DEFAULT }]
    merge({ notify_custom_templates: JSON.stringify(list) })
    setSelected(`custom:${id}`)
  }

  async function deleteCustom() {
    if (!tpl || tpl.builtIn) return
    if (!(await dialog.confirm({ title: `刪除「${tpl.label}」範本`, message: '按下「儲存變更」後才會正式刪除。', confirmLabel: '刪除', danger: true }))) return
    const id = tpl.key.slice('custom:'.length)
    merge({ notify_custom_templates: JSON.stringify(getCustomTemplates(settings!).filter(c => c.id !== id)) })
    setSelected('expense')
  }

  function resetToDefault() {
    if (isReview) {
      merge({ [`review_${reviewKind}_subject`]: REVIEW_DEFAULTS[reviewKind].subject, [`review_${reviewKind}_body`]: REVIEW_DEFAULTS[reviewKind].body })
    } else if (tpl?.builtIn) {
      const saved = parseSavedTemplates(settings!.notify_templates)
      delete saved[tpl.key]
      merge({ notify_templates: JSON.stringify(saved) })
    }
  }

  async function handleSave() {
    const s = settings!
    const blank = listCollectionTemplates(s).find(t => !t.label.trim() || !t.subject.trim() || !t.body.trim())
    if (blank) { setSelected(blank.key); setMessage({ ok: false, text: `「${blank.label || '未命名範本'}」的名稱、主旨或內容不可空白` }); return }
    setSaving(true); setMessage(null)
    const payload = Object.fromEntries(TEMPLATE_KEYS.filter(k => s[k] !== undefined).map(k => [k, s[k]]))
    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { setSnapshot(pick(s)); setMessage({ ok: true, text: '已儲存' }) }
    else {
      const d = await res.json().catch(() => ({}))
      setMessage({ ok: false, text: d.error || '儲存失敗' })
    }
    setSaving(false)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'
  const navItem = (key: string, label: string, sub: string) => {
    const active = key === selected
    return (
      <button key={key} onClick={() => setSelected(key)} aria-current={active ? 'true' : undefined}
        className={`w-full text-left rounded-lg px-3 py-2 cursor-pointer transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
        <span className="block text-sm font-medium truncate">{label}</span>
        <span className={`block text-xs truncate ${active ? 'text-blue-500' : 'text-gray-400'}`}>{sub}</span>
      </button>
    )
  }
  const groupLabel = (text: string) => <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-gray-400">{text}</p>

  const title = isReview ? `${REVIEW_LABELS[reviewKind]}通知` : tpl!.label
  const kindBadge = isReview ? '審核結果通知' : tpl!.builtIn ? '內建催收範本' : '自訂催收範本'

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-lg font-bold text-gray-800">通知信範本</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          催收範本會在總覽頁寄送催收通知時，依勾選學校的狀況自動建議；審核結果通知在核准或退回申請時自動寄出。
        </p>
      </div>

      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
        {/* 範本清單 */}
        <nav aria-label="範本清單" className="bg-white rounded-xl border border-gray-200 p-2 space-y-3 lg:sticky lg:top-4">
          <div className="space-y-0.5">
            {groupLabel('催收通知')}
            {collection.filter(t => t.builtIn).map(t => navItem(t.key, t.label, '內建'))}
            {collection.filter(t => !t.builtIn).map(t => navItem(t.key, t.label || '未命名範本', CONDITION_LABELS[t.target].replace('的學校', '')))}
            {!readOnly && (
              <button onClick={addCustom}
                className="w-full text-left rounded-lg px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer">＋ 新增自訂範本</button>
            )}
          </div>
          <div className="space-y-0.5 border-t border-gray-100 pt-2">
            {groupLabel('審核結果通知')}
            {navItem('review:approve', '審核通過', '核准申請時寄出')}
            {navItem('review:reject', '審核拒絕', '退回申請時寄出')}
          </div>
        </nav>

        {/* 編輯與預覽 */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-5 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
            <div className="min-w-0">
              <p className="text-xs text-gray-400">{kindBadge}</p>
              <h3 className="text-base font-bold text-gray-800 truncate">{title}</h3>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                {(isReview || tpl?.builtIn) && (
                  <button onClick={resetToDefault} className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">還原系統預設</button>
                )}
                {tpl && !tpl.builtIn && (
                  <button onClick={deleteCustom} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                    <TrashIcon /> 刪除範本
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid xl:grid-cols-2 gap-6">
            <div className="space-y-4 min-w-0">
              {tpl && !tpl.builtIn && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tpl-label" className="block text-sm font-medium text-gray-700 mb-1">範本名稱</label>
                    <input id="tpl-label" value={tpl.label} disabled={readOnly} onChange={e => setCustomMeta({ label: e.target.value })} className={inputCls} placeholder="例：結算表最後提醒" />
                  </div>
                  <div>
                    <label htmlFor="tpl-target" className="block text-sm font-medium text-gray-700 mb-1">適用對象</label>
                    <select id="tpl-target" value={tpl.target} disabled={readOnly} onChange={e => setCustomMeta({ target: e.target.value as NotifyCondition })} className={inputCls}>
                      {(Object.keys(CONDITION_LABELS) as NotifyCondition[]).map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {tpl?.builtIn && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">適用對象：{CONDITION_LABELS[tpl.target]}</p>
              )}
              {isReview && (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  {reviewKind === 'approve' ? '承辦人核准學校的申請（上傳檔案、修改實支金額）時，自動寄給該校。' : '承辦人退回學校的申請時，自動寄給該校，並附上退回原因。'}
                </p>
              )}

              <div>
                <label htmlFor="tpl-subject" className="block text-sm font-medium text-gray-700 mb-1">信件主旨</label>
                <input id="tpl-subject" ref={subjectRef} value={subject} disabled={readOnly}
                  onFocus={() => { lastFocused.current = 'subject' }} onChange={e => setField('subject', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="tpl-body" className="block text-sm font-medium text-gray-700 mb-1">信件內容</label>
                <textarea id="tpl-body" ref={bodyRef} value={body} disabled={readOnly} rows={14}
                  onFocus={() => { lastFocused.current = 'body' }} onChange={e => setField('body', e.target.value)} className={`${inputCls} resize-y leading-relaxed`} />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">點選變數插入到游標位置</p>
                <div className="flex flex-wrap gap-1.5">
                  {variables.map(([v, desc]) => (
                    <button key={v} type="button" onClick={() => insertVariable(v)} disabled={readOnly} title={desc}
                      className="font-mono text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:hover:bg-blue-50 rounded px-1.5 py-0.5 cursor-pointer disabled:cursor-default">
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-w-0 xl:sticky xl:top-4 self-start">
              <EmailPreview subject={subject} body={body} vars={isReview ? REVIEW_SAMPLE[reviewKind] : SAMPLE_VARS} systemName={String(settings.system_name || '')} />
            </div>
          </div>
        </section>
      </div>

      {/* 固定在底部的儲存列 */}
      <div className="sticky bottom-0 z-10 -mx-1">
        <div className="flex flex-wrap items-center gap-3 bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg px-4 py-3">
          {readOnly ? (
            <p className="text-sm text-gray-500">通知信範本僅限超級管理員修改</p>
          ) : (
            <>
              <p className={`text-sm flex-1 min-w-0 ${message ? (message.ok ? 'text-green-700' : 'text-red-600') : dirty ? 'text-amber-700' : 'text-gray-400'}`}>
                {message ? message.text : dirty ? '有尚未儲存的變更' : '所有變更都已儲存'}
              </p>
              {dirty && (
                <button onClick={() => { setSettings(prev => prev ? { ...prev, ...Object.fromEntries(TEMPLATE_KEYS.map((k, i) => [k, JSON.parse(snapshot)[i]])) } : prev); setMessage(null) }}
                  className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 cursor-pointer">捨棄變更</button>
              )}
              <button onClick={handleSave} disabled={saving || !dirty}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg cursor-pointer">
                {saving && <Spinner size="xs" />}{saving ? '儲存中…' : '儲存變更'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

