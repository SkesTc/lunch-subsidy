/** 小型 inline spinner，顏色跟隨文字顏色（藍色按鈕內為白色、白底上為灰色） */
export function Spinner({ size = 'sm', className = '' }: { size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const s = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <span role="status" aria-label="處理中" className={`inline-block ${s} border-2 border-current border-r-transparent rounded-full animate-spin opacity-70 ${className}`} />
  )
}

/** 區塊讀取中：骨架畫面（灰色條狀佔位），比轉圈更能預期內容位置 */
export function BlockSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div role="status" className="py-4 space-y-3 animate-pulse">
      <span className="sr-only">{text}</span>
      <div className="h-4 w-1/3 rounded bg-gray-200" />
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 rounded-lg bg-gray-100" />
      <div className="h-10 w-5/6 rounded-lg bg-gray-100" />
    </div>
  )
}
