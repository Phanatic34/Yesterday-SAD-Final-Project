import { cn } from '../utils/cn'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}
    />
  )
}

