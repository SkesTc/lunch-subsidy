// 統一的狀態標籤：圓角膠囊＋色點。done 已完成／pending 待審／rejected 已拒絕／missing 未完成／na 不適用
type Tone = 'done' | 'pending' | 'rejected' | 'missing' | 'na'

const TONE: Record<Tone, { chip: string; dot: string }> = {
  done: { chip: 'bg-green-50 text-green-700 ring-green-600/20', dot: 'bg-green-500' },
  pending: { chip: 'bg-amber-50 text-amber-800 ring-amber-600/25', dot: 'bg-amber-500' },
  rejected: { chip: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500' },
  missing: { chip: 'bg-gray-50 text-gray-500 ring-gray-400/30', dot: 'bg-gray-300' },
  na: { chip: 'text-gray-400 ring-transparent', dot: '' },
}

export function StatusChip({ tone, children, href, title }: { tone: Tone; children: React.ReactNode; href?: string; title?: string }) {
  const t = TONE[tone]
  const cls = `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${t.chip}`
  const content = <>{t.dot && <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />}{children}</>
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={`${cls} hover:underline underline-offset-2`}>{content}</a>
    : <span title={title} className={cls}>{content}</span>
}
