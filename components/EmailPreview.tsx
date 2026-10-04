'use client'
import { wrapEmailHtml } from '@/lib/email-html'
import { renderTemplate } from '@/lib/notifyTemplates'

// 通知信範本的範例資料（範本設定頁預覽用）
export const SAMPLE_VARS: Record<string, string> = {
  schoolName: '社口國民小學',
  contactName: '王小明',
  contactTitle: '組長',
  zoneName: '臺中市第2區',
  hostSchool: '臺中市神岡區社口國民小學',
  adminName: '王美惠',
  adminTitle: '總務主任',
  adminPhone: '04-25626834#730',
  semLabel: '115學年度第1學期',
  deadline: '2026-06-30',
  repayAmount: '96,760',
  planLabel: '開學加碼',
  planName: '115學年度開學加碼計畫',
  typeLabel: '經費收支結算表掃描檔上傳',
}

// 依範本即時產生與實際寄出相同版型的信件預覽
export function EmailPreview({ subject, body, vars, systemName }: {
  subject: string
  body: string
  vars: Record<string, string>
  systemName: string
}) {
  const text = renderTemplate(body, vars)
  const html = wrapEmailHtml({
    body: text, zoneName: vars.zoneName || '', systemName,
    hostSchool: vars.hostSchool || '', adminName: vars.adminName || '', adminTitle: vars.adminTitle || '', adminPhone: vars.adminPhone || '',
  })
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-sm">
        <p className="text-xs text-gray-400">預覽（範例資料）</p>
        <p className="font-medium text-gray-800 break-words">{renderTemplate(subject, vars) || '（未填主旨）'}</p>
      </div>
      <iframe title="信件預覽" sandbox="" srcDoc={html} className="w-full h-[420px] bg-slate-100" />
    </div>
  )
}
