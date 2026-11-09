import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '../context/ToastContext.jsx'

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)
  const started = useRef(0)

  useEffect(() => {
    if (!toast.duration || paused) return undefined
    started.current = performance.now()
    const t = setTimeout(onDismiss, remaining.current)
    return () => {
      clearTimeout(t)
      remaining.current -= performance.now() - started.current
    }
  }, [paused, toast.duration, onDismiss])

  return (
    <div
      className="toast"
      data-tone={toast.tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {toast.emoji && (
        <span className="toast-emoji emoji" aria-hidden="true">
          {toast.emoji}
        </span>
      )}
      <div className="toast-body">
        <p className="toast-title">{toast.title}</p>
        {toast.body && <p className="toast-text">{toast.body}</p>}
      </div>
      <div className="toast-actions">
        {toast.action && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              toast.action.onClick()
              onDismiss()
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onDismiss} aria-label="Dismiss notification">
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      <div aria-live="polite" aria-relevant="additions" className="stack" style={{ '--stack-gap': '0.6rem' }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </div>
  )
}
