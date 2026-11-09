import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Native <dialog> (focus trap, Esc, inert background and focus return for free).
 * variant: 'sheet' (side / bottom sheet) or 'modal' (centred).
 */
export function Dialog({ open, onClose, title, description, variant = 'sheet', children, footer, className = '', eyebrow }) {
  const ref = useRef(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`${variant} ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClose={() => open && onClose()}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <>
          <div className="dialog-head">
            <div className="stack" style={{ '--stack-gap': '0.3rem' }}>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h2 id={titleId}>{title}</h2>
              {description && (
                <p id={descId} className="muted small">
                  {description}
                </p>
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}
