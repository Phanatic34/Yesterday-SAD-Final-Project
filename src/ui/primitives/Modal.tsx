import { useEffect } from 'react'
import { cn } from '../utils/cn'

export function Modal({
  title,
  open,
  onClose,
  children,
  footer,
  maxWidthClassName = 'max-w-lg',
}: {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidthClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/30"
      />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className={cn('w-full rounded-xl border border-slate-200 bg-white shadow-xl', maxWidthClassName)}>
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">{title}</div>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && <div className="border-t border-slate-200 px-5 py-4">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

