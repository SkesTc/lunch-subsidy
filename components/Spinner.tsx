/** 小型 inline spinner，用於按鈕或區塊讀取中狀態 */
export function Spinner({ size = 'sm', className = '' }: { size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const s = size === 'xs' ? 'w-3 h-3 border-2' : size === 'sm' ? 'w-4 h-4 border-2' : 'w-5 h-5 border-2'
  return (
    <span className={`inline-block ${s} border-white/40 border-t-white rounded-full animate-spin ${className}`} />
  )
}

/** 區塊讀取中：置中顯示小 spinner + 文字 */
export function BlockSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-sm">
      <span className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      {text}
    </div>
  )
}
