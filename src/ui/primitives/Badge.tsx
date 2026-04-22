import { cn } from '../utils/cn'

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'info' | 'warn' | 'success'
}) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs',
        tone === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-700',
        tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-700',
        tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        className,
      )}
    />
  )
}

