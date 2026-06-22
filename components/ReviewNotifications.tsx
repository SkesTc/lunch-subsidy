'use client'
import { useState, useEffect } from 'react'

interface ReviewNotification {
  id: string
  semester: number
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

export default function ReviewNotifications({ notifications }: { notifications: ReviewNotification[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const stored = localStorage.getItem('dismissed_reviews')
    if (stored) setDismissed(new Set(JSON.parse(stored)))
  }, [])

  function dismiss(id: string) {
    const next = new Set([...dismissed, id])
    setDismissed(next)
    localStorage.setItem('dismissed_reviews', JSON.stringify([...next]))
  }

  const visible = notifications.filter(n => !dismissed.has(n.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2">
      {visible.map(n => {
        const isApproved = n.status === 'approved'
        const time = new Date(n.reviewed_at).toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit',
        })
        return (
          <div key={n.id}
            className={`rounded-xl px-4 py-3 flex items-start gap-3 ${isApproved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <span className="text-lg flex-shrink-0">{isApproved ? '✅' : '❌'}</span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${isApproved ? 'text-green-700' : 'text-red-700'}`}>
                第{n.semester}學期「{TYPE_LABEL[n.request_type] || n.request_type}」申請
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
            <button
              onClick={() => dismiss(n.id)}
              className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer transition-colors ${isApproved ? 'text-green-400 hover:bg-green-200' : 'text-red-400 hover:bg-red-200'}`}
              aria-label="關閉通知">
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
