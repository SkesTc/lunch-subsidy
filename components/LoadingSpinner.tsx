/** 學校端整頁載入：與實際頁面形狀相近的骨架卡片 */
export default function LoadingSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div role="status" className="min-h-screen bg-gray-50">
      <span className="sr-only">{text}</span>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-gray-200" />
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div className="h-6 w-2/3 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-100" />
          <div className="h-24 rounded-xl bg-gray-100" />
          <div className="h-11 rounded-xl bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
