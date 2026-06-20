export default function LoadingSpinner({ text = '載入中...' }: { text?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}
