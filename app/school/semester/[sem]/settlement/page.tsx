'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatAmount, calcRatio, calcSurplus, calcRepay, semLabel, toChineseAmount, parseInputAmount, formatInputDisplay } from '@/lib/utils'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Spinner } from '@/components/Spinner'

interface SchoolInfo { name: string; district: string; code: number }
interface AmountInfo { sem1_amount: number; sem2_amount: number }

export default function SettlementPage() {
  const { sem } = useParams<{ sem: string }>()
  const semester = Number(sem) as 1 | 2
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan_id') || null
  const router = useRouter()
  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [amountInfo, setAmountInfo] = useState<AmountInfo | null>(null)
  const [planAmount, setPlanAmount] = useState<number | null>(null)
  const [planLabel, setPlanLabel] = useState<string | null>(null)
  const [sem1Repay, setSem1Repay] = useState<number | null>(null)
  const [businessRaw, setBusinessRaw] = useState('')
  const [existing, setExisting] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [schoolYear, setSchoolYear] = useState('115')
  const [settingPlanName, setSettingPlanName] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [zoneName, setZoneName] = useState('')

  // 申請修改 modal
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [modifyAmount, setModifyAmount] = useState('')
  const [modifyFocused, setModifyFocused] = useState(false)
  const [modifyReason, setModifyReason] = useState('')
  const [modifyError, setModifyError] = useState('')
  const [modifySubmitting, setModifySubmitting] = useState(false)
  const [modifyDone, setModifyDone] = useState(false)

  useEffect(() => {
    const url = planId
      ? `/api/school/settlement-data?semester=${semester}&plan_id=${planId}`
      : `/api/school/settlement-data?semester=${semester}`
    fetch(url)
      .then(r => r.json())
      .then((data: { school: SchoolInfo; settlement: { business_expense?: number; amount_locked?: boolean; status?: string } | null; amounts: AmountInfo | null; schoolYear: string; planName?: string; planLabel?: string; planAmount?: number; sem1Repay?: number; zoneName?: string }) => {
        const { school: s, settlement: st, amounts: amt, schoolYear: sy, planName, planLabel: pl, planAmount: pa, zoneName: zn } = data
        setSchool(s)
        if (zn) setZoneName(zn)
        if (st?.business_expense) setBusinessRaw(String(st.business_expense))
        setExisting(st)
        setIsLocked(st?.amount_locked === true)
        if (sy) setSchoolYear(sy)
        if (planName) setSettingPlanName(planName)
        if (amt) setAmountInfo(amt)
        if (pl) setPlanLabel(pl)
        if (pa !== null && pa !== undefined) setPlanAmount(pa)
        if (data.sem1Repay !== null && data.sem1Repay !== undefined) setSem1Repay(data.sem1Repay)
        setLoading(false)
      })
  }, [semester, planId])

  if (loading || !school) return <LoadingSpinner />

  const approvedAmount = planAmount !== null
    ? planAmount
    : (semester === 1 ? (amountInfo?.sem1_amount || 0) : (amountInfo?.sem2_amount || 0))
  const b = parseInputAmount(businessRaw)
  const D = b
  const A = approvedAmount
  const B = approvedAmount
  const C = calcRatio(B, A)
  const E = calcSurplus(A, D)
  const F = D > 0 ? calcRepay(E, C) : 0
  const hasSurplus = E > 0
  const hasSaved = !!existing

  function openPdf() {
    if (!school) return
    const params = new URLSearchParams({
      sem: String(semester),
      schoolName: school.name,
      schoolCode: zoneName ? `${zoneName}-${String(school.code).padStart(3, '0')}` : String(school.code),
      schoolYear,
      A: String(A), B: String(B), C: String(C),
      D: String(D), E: String(E), F: String(F),
      b: String(b),
      ...(settingPlanName ? { planName: settingPlanName } : {}),
    })
    window.open(`/settlement-print?${params}`, '_blank')
  }

  async function handleSave() {
    setSaveError('')
    if (b <= 0) { setSaveError('請輸入實支金額'); return }
    if (b > A) { setSaveError(`實支金額（${formatAmount(b)}）超過核定金額（${formatAmount(A)}），無法儲存`); return }
    setSaving(true)
    const res = await fetch('/api/settlement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semester, personnel_expense: 0, business_expense: b, equipment_expense: 0, ...(planId ? { plan_id: planId } : {}) }),
    })
    if (res.ok) {
      setExisting((prev: any) => ({ ...prev, business_expense: b, amount_locked: true }))
      setIsLocked(true)
      router.refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      setSaveError(d.error || '儲存失敗，請重試')
    }
    setSaving(false)
  }

  async function handleDownload() {
    setDownloading(true)
    openPdf()
    setDownloading(false)
  }

  async function handleModifySubmit() {
    const amt = parseInputAmount(modifyAmount)
    if (amt <= 0) { setModifyError('請輸入正確的金額'); return }
    if (amt > A) { setModifyError(`申請金額（${formatAmount(amt)}）不可超過核定金額（${formatAmount(A)}）`); return }
    if (!modifyReason.trim()) { setModifyError('請填寫修改原因'); return }
    setModifySubmitting(true); setModifyError('')
    const res = await fetch('/api/settlement/change-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ semester, ...(planId ? { plan_id: planId } : {}), new_amount: amt, reason: modifyReason }),
    })
    const data = await res.json()
    if (res.ok) {
      setModifyDone(true)
    } else {
      setModifyError(data.error || '送出失敗')
    }
    setModifySubmitting(false)
  }

  function closeModal() {
    setShowModifyModal(false)
    setModifyAmount('')
    setModifyReason('')
    setModifyError('')
    setModifyDone(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Link href="/school" className="text-blue-600 hover:underline text-sm">← 返回首頁</Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm text-gray-600">{planLabel || `第${semester}學期`}・填寫實支金額</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">填寫實支金額</h1>
            <p className="text-sm text-gray-500 mt-1">{planLabel || semLabel(semester)}・{school.name}</p>
          </div>

          {/* 核定金額（唯讀） */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
            {sem1Repay !== null && sem1Repay > 0 && (
              <div className="text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-700 mb-1">
                第1學期結餘款 NT$ {formatAmount(sem1Repay)} 將從本學期撥款中扣除<br />
                <span className="font-semibold">淨撥款金額：NT$ {formatAmount(A - sem1Repay)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-blue-700 font-medium">A. 核定計畫金額</span>
              <div className="text-right">
                <p className="font-bold text-blue-800">NT$ {formatAmount(A)}</p>
                <p className="text-xs text-blue-500">{toChineseAmount(A)}</p>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">B. 核定補助金額</span>
              <span className="font-bold">NT$ {formatAmount(B)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">C. 補助比率 (B/A)</span>
              <span className="font-bold">{(C * 100).toFixed(2)}%</span>
            </div>
          </div>

          {/* 實支金額區 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">D. 實支總額</h2>

            {isLocked ? (
              /* 鎖定狀態 */
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">業務費（經常門）</p>
                    <p className="text-xl font-bold text-gray-800">NT$ {formatAmount(b)}</p>
                    {b > 0 && <p className="text-xs text-gray-400 mt-0.5">{toChineseAmount(b)}</p>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                    已鎖定
                  </div>
                </div>
              </div>
            ) : (
              /* 可編輯狀態 */
              <div>
                <label className="block text-sm text-gray-600 mb-1">業務費（經常門）</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={focused ? businessRaw : formatInputDisplay(b)}
                  onChange={e => setBusinessRaw(e.target.value.replace(/[^0-9]/g, ''))}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right"
                  placeholder="0"
                />
                {b > 0 && <p className="text-xs text-gray-400 mt-1 text-right">{toChineseAmount(b)}</p>}
                {b > A && A > 0 && (
                  <p className="text-xs text-red-600 mt-1 font-medium">⚠️ 實支金額超過核定金額，無法儲存</p>
                )}
              </div>
            )}
          </div>

          {/* 自動計算結果 */}
          {D > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm border border-gray-200">
              <div>
                <div className="flex justify-between font-semibold">
                  <span>D. 實支總額合計</span>
                  <span>NT$ {formatAmount(D)}</span>
                </div>
                <p className="text-xs text-gray-400 text-right mt-0.5">{toChineseAmount(D)}</p>
              </div>
              <div>
                <div className="flex justify-between">
                  <span className={hasSurplus ? 'text-orange-600' : 'text-green-600'}>E. 計畫結餘款 (A-D)</span>
                  <span className={`font-medium ${hasSurplus ? 'text-orange-600' : 'text-green-600'}`}>
                    NT$ {formatAmount(E)}
                  </span>
                </div>
                {E !== 0 && <p className="text-xs text-gray-400 text-right mt-0.5">{toChineseAmount(Math.abs(E))}</p>}
              </div>
              {hasSurplus && (
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-red-600">F. 應繳回本局 (E×C，無條件進位)</span>
                  <span className="text-red-600 font-bold">NT$ {formatAmount(F)}</span>
                </div>
              )}
              {semester === 2 && hasSurplus && (
                <div className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2">
                  ⚠ 有賸餘款 NT$ {formatAmount(F)} 需繳回公庫，請完成繳款後上傳送款憑單
                </div>
              )}
            </div>
          )}

          {/* 按鈕區 */}
          <div className="space-y-3">
            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                ⚠️ {saveError}
              </div>
            )}
            {!isLocked && (
              <button
                onClick={handleSave}
                disabled={saving || D === 0 || b > A}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? <span className="flex items-center justify-center gap-2"><Spinner /> 儲存中...</span> : '儲存'}
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading || !hasSaved}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {downloading ? <span className="flex items-center justify-center gap-2"><Spinner /> 處理中...</span> : '下載經費收支結算表 PDF'}
            </button>

            {isLocked && (
              <button
                onClick={() => setShowModifyModal(true)}
                className="w-full border border-amber-400 text-amber-700 hover:bg-amber-50 font-medium py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
              >
                申請修改金額
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 text-center">
            下載後請列印、逐級核章，再至下一步上傳掃描檔
          </p>
        </div>
      </div>

      {/* 申請修改 Modal */}
      {showModifyModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            {modifyDone ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl">📨</div>
                <p className="font-semibold text-gray-800">申請已送出</p>
                <p className="text-sm text-gray-500">承辦學校審核通過後，您即可重新下載經費收支結算表</p>
                <button onClick={closeModal}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-700">
                  確定
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">申請修改金額</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                  目前金額：<strong>NT$ {formatAmount(b)}</strong>，修改申請需等承辦學校審核通過後生效。
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">修改後的實支金額（元）</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={modifyFocused ? modifyAmount : formatInputDisplay(parseInputAmount(modifyAmount))}
                      onChange={e => setModifyAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      onFocus={() => setModifyFocused(true)}
                      onBlur={() => setModifyFocused(false)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-right"
                      placeholder="請輸入新的金額"
                    />
                    {parseInputAmount(modifyAmount) > 0 && (
                      <p className="text-xs text-gray-400 mt-1 text-right">{toChineseAmount(parseInputAmount(modifyAmount))}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">修改原因 <span className="text-red-500">*</span></label>
                    <textarea
                      value={modifyReason}
                      onChange={e => setModifyReason(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="請說明修改原因..."
                    />
                  </div>
                </div>

                {modifyError && <p className="text-sm text-red-600">{modifyError}</p>}

                <div className="flex gap-3">
                  <button onClick={closeModal}
                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm cursor-pointer hover:bg-gray-50">
                    取消
                  </button>
                  <button onClick={handleModifySubmit} disabled={modifySubmitting}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-700 disabled:bg-gray-300">
                    {modifySubmitting ? <span className="flex items-center justify-center gap-2"><Spinner /> 送出中...</span> : '送出申請'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
