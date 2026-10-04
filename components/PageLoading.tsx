// 整頁載入畫面（伺服器端查詢資料期間立即顯示，避免空白）
export default function PageLoading({ text = '載入中…' }: { text?: string }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-[60px] bg-blue-700 shadow" aria-hidden />
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 pt-32 text-gray-500">
        <span className="w-10 h-10 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin motion-reduce:animate-none" aria-hidden />
        <p className="text-sm">{text}</p>
      </div>
    </div>
  )
}
