// 線條圖示（取代 emoji，大小與筆畫一致）
type P = { size?: number; className?: string }
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true })

export const SearchIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const FolderIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
)
export const DownloadIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
)
export const ChevronDownIcon = ({ size = 12, className }: P) => (
  <svg {...base(size)} strokeWidth={2.5} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
export const MailIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
)
