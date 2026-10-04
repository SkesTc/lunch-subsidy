'use client'
import { StatusChip } from '@/components/StatusChip'
import { useDialog } from '@/components/DialogProvider'
import React, { useState, useEffect } from 'react'
import { formatAmount } from '@/lib/utils'
import { Spinner, BlockSpinner } from '@/components/Spinner'
import type { School, ProfileRow, ContactInfo, Plan } from '../types'
import { FileViewerModal } from '../components/FileViewerModal'

// ── 申請審核頁籤 ───────────────────────────────────────────
export default function ReviewTab({ activeSchoolYear, schools, profiles, contacts, plans, onReviewDone }: {
  activeSchoolYear: string
  schools: School[]
  profiles: ProfileRow[]
  contacts: Record<string, ContactInfo>
  plans: Plan[]
  onReviewDone: () => void
}) {
  const dialog = useDialog()
  interface ChangeRequest { school_id: number; school_name: string; school_code: number; school_year: string; status: string; new_info: Record<string, string>; file_id: string; submitted_at: string; admin_note: string; reviewed_at: string | null }
  interface SettleReq {
    id: string; school_id: number; semester: number; plan_id: string | null; plan_label: string | null
    request_type: string; new_amount: number | null; reason: string; status: string; created_at: string
    pending_file_path: string | null; pending_file_ext: string | null; existing_file_path: string | null
    existing_amount: number | null; approved_amount: number | null
    actual_expense: number | null; surplus: number | null
    admin_note: string | null; reviewed_at: string | null
    schools: { name: string; code: number; district: string }
  }

  const [accountRequests, setAccountRequests] = useState<ChangeRequest[]>([])
  const [settleReqs, setSettleReqs] = useState<SettleReq[]>([])
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({})
  const [settleNote, setSettleNote] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [planFilter, setPlanFilter] = useState<string | null>(null) // null = 全部計畫
  const [typeFilter, setTypeFilter] = useState<string>('all') // 申請類型篩選
  const [viewer, setViewer] = useState<{ fileId: string; fileExt: string | null } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    action: 'approve' | 'reject' | 'approved' | 'rejected'
    label: string
    schoolName: string
    typeDesc: string
    onConfirm: () => void
  } | null>(null)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/admin/account-changes').then(r => r.json()),
      fetch('/api/admin/change-requests').then(r => r.json()),
    ]).then(([ac, sr]) => {
      setAccountRequests(Array.isArray(ac) ? ac : [])
      setSettleReqs(Array.isArray(sr) ? sr : [])
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  async function handleAccountReview(req: ChangeRequest, action: 'approve' | 'reject') {
    const key = `${req.school_id}_${req.school_year}`
    setReviewing(key)
    const res = await fetch('/api/admin/account-changes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: req.school_id, schoolYear: req.school_year, action, adminNote: reviewNote[key] || '' }),
    })
    setReviewing(null)
    if (res.ok) {
      load(); onReviewDone()
    } else {
      const d = await res.json().catch(() => ({}))
      await dialog.alert({ title: '操作失敗', message: String(d.error || `HTTP ${res.status}`), tone: 'error' })
    }
  }

  async function handleSettleReview(id: string, action: 'approved' | 'rejected') {
    setReviewing(id)
    const res = await fetch('/api/admin/change-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_note: settleNote[id] || '' }),
    })
    if (res.ok) {
      setSettleReqs(prev => prev.map(r => r.id === id ? { ...r, status: action } : r))
      onReviewDone()
    }
    setReviewing(null)
  }

  const pendingAccount = accountRequests.filter(r => r.status === 'pending')
  const pendingSettle = settleReqs.filter(r => r.status === 'pending')
  const totalPending = pendingAccount.length + pendingSettle.length

  const typeLabel = (t: string) => ({
    scan_upload: '首次上傳掃描檔', scan_reupload: '重新上傳掃描檔',
    remittance_upload: '首次上傳送款憑單', remittance_reupload: '重新上傳送款憑單',
    amount_modify: '修改實支金額',
  }[t] || t)

  const subTabCls = (t: typeof subTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${subTab === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`

  if (loading) return <BlockSpinner />

  // 依子分頁 + 計畫 + 類型 過濾
  const filteredSettle = settleReqs.filter(r => {
    const matchStatus = subTab === 'pending' ? r.status === 'pending' :
      subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
    const matchPlan = planFilter === null
      ? true
      : planFilter === '__no_plan__'
        ? !r.plan_id
        : r.plan_id === planFilter
    const matchType = typeFilter === 'all' ? true : typeFilter === 'account' ? false : r.request_type === typeFilter
    return matchStatus && matchPlan && matchType
  })
  // 帳戶變更申請有計畫過濾時隱藏（帳戶申請無 plan_id 概念）
  const filteredAccount = accountRequests.filter(r => {
    if (planFilter !== null && planFilter !== '__no_plan__') return false
    if (typeFilter !== 'all' && typeFilter !== 'account') return false
    return subTab === 'pending' ? r.status === 'pending' :
      subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
  })
  const isEmpty = filteredAccount.length === 0 && filteredSettle.length === 0

  const approvedCount = accountRequests.filter(r => r.status === 'approved').length + settleReqs.filter(r => r.status === 'approved').length
  const rejectedCount = accountRequests.filter(r => r.status === 'rejected').length + settleReqs.filter(r => r.status === 'rejected').length

  return (
    <div className="space-y-4">
      {/* 確認對話框 */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className={`text-center mb-4 text-3xl`}>{confirmDialog.action === 'approve' || confirmDialog.action === 'approved' ? '✅' : '⛔'}</div>
            <h3 className="text-base font-bold text-gray-800 text-center mb-1">確認{confirmDialog.label}？</h3>
            <p className="text-sm text-gray-500 text-center mb-4">此操作送出後<span className="text-red-500 font-medium">無法撤銷</span></p>
            <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1 text-sm">
              <div><span className="text-gray-400">學校：</span><span className="font-medium text-gray-800">{confirmDialog.schoolName}</span></div>
              <div><span className="text-gray-400">申請項目：</span><span className="font-medium text-gray-800">{confirmDialog.typeDesc}</span></div>
              <div><span className="text-gray-400">操作：</span><span className={`font-bold ${confirmDialog.action === 'approve' || confirmDialog.action === 'approved' ? 'text-green-600' : 'text-red-500'}`}>{confirmDialog.label}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)}
                className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">取消</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                className={`flex-1 text-white font-bold py-2.5 rounded-xl cursor-pointer ${confirmDialog.action === 'approve' || confirmDialog.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}>
                確認{confirmDialog.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 子分頁 + 重新整理 */}
      <div className="flex items-center gap-2">
        <button className={subTabCls('pending')} onClick={() => setSubTab('pending')}>
          待審核
          {totalPending > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${subTab === 'pending' ? 'bg-white text-purple-700' : 'bg-purple-600 text-white'}`}>{totalPending}</span>}
        </button>
        <button className={subTabCls('approved')} onClick={() => setSubTab('approved')}>
          已通過
          {approvedCount > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${subTab === 'approved' ? 'bg-white text-purple-700' : 'bg-green-100 text-green-700'}`}>{approvedCount}</span>}
        </button>
        <button className={subTabCls('rejected')} onClick={() => setSubTab('rejected')}>
          已拒絕
          {rejectedCount > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${subTab === 'rejected' ? 'bg-white text-purple-700' : 'bg-red-100 text-red-600'}`}>{rejectedCount}</span>}
        </button>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-purple-400 bg-white cursor-pointer">
          <option value="all">全部類型</option>
          <option value="amount_modify">修改實支金額</option>
          <option value="scan_upload">首次上傳掃描檔</option>
          <option value="scan_reupload">重新上傳掃描檔</option>
          <option value="remittance_upload">首次上傳送款憑單</option>
          <option value="remittance_reupload">重新上傳送款憑單</option>
          <option value="account">帳戶變更申請</option>
        </select>
        <button onClick={load} className="text-sm text-gray-500 border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">↻ 重新整理</button>
      </div>

      {/* 計畫篩選（有計畫時顯示） */}
      {plans.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(() => {
            const countForPlan = (planId: string | null) => settleReqs.filter(r => {
              const matchStatus = subTab === 'pending' ? r.status === 'pending' : subTab === 'approved' ? r.status === 'approved' : r.status === 'rejected'
              const matchPlan = planId === null ? true : r.plan_id === planId
              return matchStatus && matchPlan
            }).length
            const allCount = countForPlan(null)
            return (
              <>
                <button onClick={() => setPlanFilter(null)}
                  className={`px-3 py-1 text-xs rounded-lg cursor-pointer border transition-colors flex items-center gap-1.5 ${planFilter === null ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  全部計畫
                  {allCount > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${planFilter === null ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-600'}`}>{allCount}</span>}
                </button>
                {plans.map(p => {
                  const cnt = countForPlan(p.id)
                  return (
                    <button key={p.id} onClick={() => setPlanFilter(p.id)}
                      className={`px-3 py-1 text-xs rounded-lg cursor-pointer border transition-colors flex items-center gap-1.5 ${planFilter === p.id ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                      {p.label}
                      {cnt > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${planFilter === p.id ? 'bg-white text-gray-700' : 'bg-gray-100 text-gray-600'}`}>{cnt}</span>}
                    </button>
                  )
                })}
              </>
            )
          })()}
        </div>
      )}

      {/* 帳戶變更申請 */}
      {filteredAccount.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-orange-700">📋 帳戶變更申請（{filteredAccount.length} 件）</h3>
          {filteredAccount.map(req => {
            const key = `${req.school_id}_${req.school_year}`
            const isDone = req.status !== 'pending'
            return (
              <div key={key} className="bg-white rounded-xl border border-orange-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{req.school_name}</span>
                    <span className="text-xs text-gray-400">{new Date(req.submitted_at).toLocaleString('zh-TW')}</span>
                    {isDone && <StatusChip tone={req.status === 'approved' ? 'done' : 'rejected'}>{req.status === 'approved' ? '已核准' : '已拒絕'}</StatusChip>}
                  </div>
                  <a href={`https://drive.google.com/file/d/${req.file_id}/view`} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 px-3 py-1 rounded-lg">📄 開啟附件</a>
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-1">
                  {Object.entries(req.new_info).map(([k, v]) => (
                    <span key={k}><span className="text-gray-400">{({ bank_name: '銀行', branch_name: '分行', bank_code: '代碼', account_name: '戶名', account_number: '帳號' } as Record<string, string>)[k] || k}：</span>{v}</span>
                  ))}
                </div>
                {!isDone && (
                  <div className="flex gap-2 items-center">
                    <input value={reviewNote[key] || ''} onChange={e => setReviewNote(p => ({ ...p, [key]: e.target.value }))}
                      placeholder="備註（選填）" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
                    <button onClick={() => setConfirmDialog({ action: 'approve', label: '核准', schoolName: req.school_name, typeDesc: '帳戶變更申請', onConfirm: () => handleAccountReview(req, 'approve') })} disabled={reviewing === key}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg cursor-pointer">
                      {reviewing === key ? <span className='flex items-center gap-1'><Spinner size='xs' /> 處理中...</span> : '✓ 核准'}
                    </button>
                    <div className="w-3" />
                    <button onClick={() => setConfirmDialog({ action: 'reject', label: '拒絕', schoolName: req.school_name, typeDesc: '帳戶變更申請', onConfirm: () => handleAccountReview(req, 'reject') })} disabled={reviewing === key}
                      className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg cursor-pointer">✕ 拒絕</button>
                  </div>
                )}
                {isDone && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusChip tone={req.status === 'approved' ? 'done' : 'rejected'}>{req.status === 'approved' ? '已核准' : '已拒絕'}</StatusChip>
                      {req.reviewed_at && <span className="text-gray-400">{new Date(req.reviewed_at).toLocaleString('zh-TW')}</span>}
                    </div>
                    {req.admin_note && <p className="text-xs text-gray-400 px-1">備註：{req.admin_note}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 核銷相關申請（首次上傳 + 重新上傳 + 金額修改） */}
      {filteredSettle.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-violet-700">✏️ 核銷申請（{filteredSettle.length} 件）</h3>
          {filteredSettle.map(req => {
            const tl = typeLabel(req.request_type)
            const boundEmail = profiles.find(p => p.school_id === req.school_id)?.email
            const c = boundEmail ? contacts[boundEmail] : null
            const isFile = req.request_type !== 'amount_modify'
            const isFirstUpload = req.request_type === 'scan_upload' || req.request_type === 'remittance_upload'
            const fileDesc = req.request_type.includes('scan') ? '經費收支結算表掃描檔' : '賸餘款送款憑單'
            const isDone = req.status !== 'pending'
            const actionColor = isFirstUpload ? 'blue' : 'violet'
            return (
              <div key={req.id} className={`bg-white rounded-xl border p-4 space-y-3 ${isFirstUpload ? 'border-blue-200' : 'border-violet-200'}`}>
                {/* 標題列：清楚說明審核動作 */}
                <div className={`rounded-lg px-3 py-2 ${isFirstUpload ? 'bg-blue-50' : 'bg-violet-50'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isFirstUpload ? 'text-blue-800' : 'text-violet-800'}`}>
                        {req.request_type === 'amount_modify' ? '📝' : '📄'} {tl}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isFirstUpload ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                      {req.plan_label ? `${req.plan_label}・第${req.semester}學期` : `第${req.semester}學期`}
                    </span>
                  </div>
                  {isFile && (
                    <p className={`text-xs mt-1 ${isFirstUpload ? 'text-blue-600' : 'text-violet-600'}`}>
                      審核文件：<strong>{fileDesc}</strong>
                      {isFirstUpload ? '（首次上傳，核准後生效）' : '（重新上傳，核准後取代現有檔案）'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{req.schools?.name}</span>
                  <span className="text-xs text-gray-400">・{new Date(req.created_at).toLocaleString('zh-TW')}</span>
                </div>

                {(boundEmail || c) && (
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1">
                    {boundEmail && <span>📧 {boundEmail}</span>}
                    {c?.contact_name && <span>👤 {c.contact_name}{c.contact_title ? `・${c.contact_title}` : ''}</span>}
                    {c?.contact_phone && <span>📞 {c.contact_phone}</span>}
                  </div>
                )}

                {req.request_type === 'amount_modify' && req.new_amount != null && (
                  <div className="bg-gray-50 rounded-lg p-3 text-sm flex flex-wrap items-center gap-4">
                    {req.approved_amount != null && (
                      <><div><span className="text-xs text-blue-400 block mb-0.5">核定金額</span>
                        <span className="font-medium text-blue-600">NT$ {formatAmount(req.approved_amount)}</span></div>
                      <span className="text-gray-300">│</span></>
                    )}
                    <div><span className="text-xs text-gray-400 block mb-0.5">目前實支</span>
                      <span className="font-medium text-gray-600">{req.existing_amount != null ? `NT$ ${formatAmount(req.existing_amount)}` : '—'}</span></div>
                    <span className="text-gray-400 text-lg">→</span>
                    <div><span className="text-xs text-gray-400 block mb-0.5">申請修改為</span>
                      <span className="font-bold text-gray-800">NT$ {formatAmount(req.new_amount)}</span></div>
                  </div>
                )}

                {isFile && (
                  <div className="space-y-2">
                    {/* 財務摘要 */}
                    {(req.approved_amount != null || req.actual_expense != null) && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs flex flex-wrap gap-x-5 gap-y-1">
                        {req.approved_amount != null && (
                          <div><span className="text-gray-400">核定金額　</span><span className="font-semibold text-blue-700">NT$ {formatAmount(req.approved_amount)}</span></div>
                        )}
                        {req.actual_expense != null && (
                          <div><span className="text-gray-400">實支金額　</span><span className="font-semibold text-gray-800">NT$ {formatAmount(req.actual_expense)}</span></div>
                        )}
                        {req.surplus != null && (
                          <div>
                            <span className="text-gray-400">結餘款　</span>
                            <span className={`font-semibold ${req.surplus > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                              NT$ {formatAmount(req.surplus)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* 檔案連結 */}
                    <div className="flex gap-2 flex-wrap">
                      {req.existing_file_path && (
                        <a href={`https://drive.google.com/file/d/${req.existing_file_path}/view`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 px-3 py-1.5 rounded-lg">
                          📄 現有檔案
                        </a>
                      )}
                      {req.pending_file_path && !req.pending_file_path.includes('/') && (
                        <button onClick={() => window.open(`/admin/file-viewer?fileId=${encodeURIComponent(req.pending_file_path!)}&fileExt=${encodeURIComponent(req.pending_file_ext || '')}`, '_blank')}
                          className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg cursor-pointer">
                          📄 待審檔案
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {req.reason && req.reason !== '首次上傳' && !req.reason.startsWith('DATE:') && (
                  <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-400">申請原因：</span>{req.reason}
                  </div>
                )}

                {isDone ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <StatusChip tone={req.status === 'approved' ? 'done' : 'rejected'}>{req.status === 'approved' ? '已核准' : '已拒絕'}</StatusChip>
                      {req.reviewed_at && <span className="text-gray-400">{new Date(req.reviewed_at).toLocaleString('zh-TW')}</span>}
                    </div>
                    {req.admin_note && (
                      <p className="text-xs text-gray-400 px-1">備註：{req.admin_note}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input value={settleNote[req.id] || ''} onChange={e => setSettleNote(p => ({ ...p, [req.id]: e.target.value }))}
                      placeholder="備註（選填）" className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-violet-400" />
                    <button onClick={() => setConfirmDialog({ action: 'approved', label: '核准', schoolName: req.schools?.name || '', typeDesc: tl, onConfirm: () => handleSettleReview(req.id, 'approved') })} disabled={reviewing === req.id}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg cursor-pointer">
                      {reviewing === req.id ? <span className='flex items-center gap-1'><Spinner size='xs' /> 處理中...</span> : '✓ 核准'}
                    </button>
                    <div className="w-3" />
                    <button onClick={() => setConfirmDialog({ action: 'rejected', label: '拒絕', schoolName: req.schools?.name || '', typeDesc: tl, onConfirm: () => handleSettleReview(req.id, 'rejected') })} disabled={reviewing === req.id}
                      className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-6 py-2 rounded-lg cursor-pointer">✕ 拒絕</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isEmpty && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">{subTab === 'pending' ? '✅' : subTab === 'approved' ? '📋' : '📋'}</div>
          <p className="font-medium">{subTab === 'pending' ? '目前沒有待審核的申請' : subTab === 'approved' ? '尚無已通過的申請' : '尚無已拒絕的申請'}</p>
        </div>
      )}
      {viewer && <FileViewerModal fileId={viewer.fileId} fileExt={viewer.fileExt} onClose={() => setViewer(null)} />}
    </div>
  )
}
