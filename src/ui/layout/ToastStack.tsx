import { useAppState } from '../../state/AppState'

export function ToastStack() {
  const { toasts, dismissToast } = useAppState()
  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.slice(-4).map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">{t.title}</div>
              {t.message && (
                <div className="mt-0.5 truncate text-xs text-slate-500">{t.message}</div>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

