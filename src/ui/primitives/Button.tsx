import { cn } from '../utils/cn'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3' : 'h-9 px-3.5',
        variant === 'primary' &&
          'border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
        variant === 'secondary' &&
          'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
        variant === 'ghost' && 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100',
        variant === 'danger' && 'border-rose-600 bg-rose-600 text-white hover:bg-rose-500',
        className,
      )}
    />
  )
}

