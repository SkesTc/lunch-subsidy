/** 小型 inline spinner，顏色跟隨文字顏色（藍色按鈕內為白色、白底上為灰色） */
export function Spinner({ size = 'sm', className = '' }: { size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const s = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <span role="status" aria-label="處理中" className={`inline-block ${s} border-2 border-current border-r-transparent rounded-full animate-spin opacity-70 ${className}`} />
  )
}

/** 區塊讀取中：轉圈圖示＋「載入中」文字＋表格骨架的白色卡片，在淺灰底頁面上也清楚可見 */
export function BlockSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div role="status" aria-live="polite" className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-2.5 text-sm text-gray-500">
        <span className="w-4 h-4 rounded-full border-2 border-blue-100 border-t-blue-600 animate-spin motion-reduce:animate-none" aria-hidden />
        {text}
      </div>
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-10 rounded bg-gray-100" />
            <div className="h-4 flex-1 rounded bg-gray-200/70" />
            <div className="h-4 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
