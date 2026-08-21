'use client'
import { useState, useEffect } from 'react'

interface ReviewNotification {
  id: string
  semester: number
  plan_id?: string | null
  request_type: string
  status: 'approved' | 'rejected'
  reviewed_at: string
}

const TYPE_LABEL: Record<string, string> = {
  scan_upload: '首次上傳經費收支結算表掃描檔',
  scan_reupload: '經費收支結算表掃描檔重新上傳',
  remittance_upload: '首次上傳賸餘款送款憑單',
  remittance_reupload: '賸餘款送款憑單重新上傳',
  amount_modify: '實支金額修改',
}

function NotifCard({ n, planLabelMap, onDismiss }: {
  n: ReviewNotification
  planLabelMap?: Record<string, string>
  onDismiss?: () => void
}) {
  const isApproved = n.status === 'approved'
  const time = new Date(n.reviewed_at).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const planLabel = n.plan_id && planLabelMap?.[n.plan_id] ? planLabelMap[n.plan_id] : null
  const semLabel = planLabel ? `${planLabel}・第${n.semester}學期` : `第${n.semester}學期`
  return (
    <div className={`rounded-xl px-4 py-3 flex items-start gap-3 ${isApproved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <span className="text-lg flex-shrink-0">{isApproved ? '✅' : '❌'}</span>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${isApproved ? 'text-green-700' : 'text-red-700'}`}>
          {semLabel}「{TYPE_LABEL[n.request_type] || n.request_type}」申請
          {isApproved ? '已核准通過' : '未通過審核'}
        </p>
        <p className={`text-xs mt-0.5 ${isApproved ? 'text-green-600' : 'text-red-600'}`}>
          {isApproved
            ? n.request_type === 'amount_modify'
              ? '金額已更新，您可重新下載結算表。'
              : '新檔案已生效，請至對應步驟確認。'
            : '請重新提出申請，如有疑問請聯絡承辦學校。'}
        </p>
        <p className="text-xs text-gray-400 mt-1">審核時間：{time}</p>
      </div>
      {onDismiss && (
        <button onClick={onDismiss}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer transition-colors ${isApproved ? 'text-green-400 hover:bg-green-200' : 'text-red-400 hover:bg-red-200'}`}
          aria-label="關閉通知">
          ✕
        </button>
      )}
    </div>
  )
}

export default function ReviewNotifications({ notifications, planLabelMap }: {
  notifications: ReviewNotification[]
  planLabelMap?: Record<string, string>
}) {
  const [dismissed, setDismissed] = useState<Set<string> | null>(null) // null = 尚未從 localStorage 讀取
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('dismissed_reviews')
    setDismissed(stored ? new Set(JSON.parse(stored)) : new Set())
  }, [])

  function dismiss(id: string) {
    const current = dismissed ?? new Set<string>()
    const next = new Set([...current, id])
    setDismissed(next)
    localStorage.setItem('dismissed_reviews', JSON.stringify([...next]))
  }

  // localStorage 尚未讀取完成時不渲染，避免通知閃現後消失
  if (dismissed === null) return null

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const visible = notifications.filter(n =>
    !dismissed.has(n.id) && new Date(n.reviewed_at).getTime() > sevenDaysAgo
  )
  const total = notifications.length

  return (
    <>
      {/* 新通知（未關閉的） */}
      {visible.length > 0 && (
        <div className="space-y-2">
          {visible.map(n => (
            <NotifCard key={n.id} n={n} planLabelMap={planLabelMap} onDismiss={() => dismiss(n.id)} />
          ))}
        </div>
      )}

      {/* 審核訊息歷史按鈕（有記錄就顯示） */}
      {total > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setShowHistory(true)}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-1">
            📋 審核訊息紀錄（{total} 筆）
          </button>
        </div>
      )}

      {/* 歷史訊息 Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowHistory(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">審核訊息紀錄</h2>
              <button onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {[...notifications].sort((a, b) =>
                new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
              ).map(n => (
                <NotifCard key={n.id} n={n} planLabelMap={planLabelMap} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
