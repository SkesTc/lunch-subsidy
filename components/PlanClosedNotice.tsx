// 未開放送件（計畫關閉或學期期程關閉）時，學校端頁面頂部的唯讀提示
export function PlanClosedNotice() {
  return (
    <div role="status" className="flex gap-3 items-start bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <div className="text-sm">
        <p className="font-medium text-gray-700">目前未開放送件，資料僅供檢視</p>
        <p className="text-gray-500 text-xs mt-0.5">已填報的金額與已上傳的檔案仍可查看、下載；如需修改，請聯絡承辦人員。</p>
      </div>
    </div>
  )
}
