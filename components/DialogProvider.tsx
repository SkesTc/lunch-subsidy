'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; danger?: boolean }
type AlertOptions = { title: string; message?: string; tone?: 'success' | 'error' | 'info' }

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: (ok: boolean) => void }

const DialogContext = createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  alert: (opts: AlertOptions) => Promise<void>
} | null>(null)

// 取代瀏覽器原生 alert()／confirm()，樣式與系統其他視窗一致
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback((opts: ConfirmOptions) =>
    new Promise<boolean>(resolve => setPending({ kind: 'confirm', opts, resolve })), [])
  const alert = useCallback((opts: AlertOptions) =>
    new Promise<void>(resolve => setPending({ kind: 'alert', opts, resolve: () => resolve() })), [])

  const close = useCallback((ok: boolean) => {
    setPending(prev => { prev?.resolve(ok); return null })
  }, [])

  useEffect(() => {
    if (!pending) return
    primaryRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  const icon = !pending ? '' : pending.kind === 'confirm'
    ? (pending.opts.danger ? '⚠️' : '❓')
    : pending.opts.tone === 'success' ? '✅' : pending.opts.tone === 'error' ? '⛔' : 'ℹ️'
  const danger = pending?.kind === 'confirm' && pending.opts.danger

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) close(false) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="dialog-title"
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-center text-3xl mb-3" aria-hidden>{icon}</div>
            <h3 id="dialog-title" className="text-base font-bold text-gray-800 text-center">{pending.opts.title}</h3>
            {pending.opts.message && (
              <p className="text-sm text-gray-600 text-center mt-2 whitespace-pre-line break-words">{pending.opts.message}</p>
            )}
            <div className="flex gap-3 mt-6">
              {pending.kind === 'confirm' && (
                <button onClick={() => close(false)}
                  className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                  取消
                </button>
              )}
              <button ref={primaryRef} onClick={() => close(true)}
                className={`flex-1 text-white font-bold py-2.5 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 ${danger ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400'}`}>
                {pending.kind === 'confirm' ? (pending.opts.confirmLabel || '確定') : '知道了'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog 必須在 DialogProvider 內使用')
  return ctx
}
