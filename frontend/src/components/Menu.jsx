import { useEffect, useId, useRef, useState } from 'react'

/**
 * Accessible menu button (WAI-ARIA menu pattern): arrow keys move, Esc closes
 * and returns focus, click outside closes.
 * items: [{ key, label, icon, onSelect, disabled, danger }] | { separator: true } | { heading }
 */
export function Menu({ label, icon: Icon, items, buttonClassName = 'btn btn-ghost btn-icon btn-sm', buttonLabel, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const id = useId()

  const focusItem = (dir) => {
    const els = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])]
    if (!els.length) return
    const i = els.indexOf(document.activeElement)
    const next = dir === 'first' ? 0 : dir === 'last' ? els.length - 1 : (i + dir + els.length) % els.length
    els[next].focus()
  }

  useEffect(() => {
    if (!open) return undefined
    requestAnimationFrame(() => focusItem('first'))
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) btnRef.current?.focus()
  }

  return (
    <div className="tooltip-host menu-host">
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={buttonLabel ? undefined : label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        {Icon && <Icon aria-hidden="true" />}
        {buttonLabel && <span>{buttonLabel}</span>}
      </button>
      {open && (
        <div
          id={id}
          ref={menuRef}
          className="menu"
          role="menu"
          aria-label={label}
          style={align === 'left' ? { left: 0, right: 'auto' } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              focusItem(1)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              focusItem(-1)
            } else if (e.key === 'Home') {
              e.preventDefault()
              focusItem('first')
            } else if (e.key === 'End') {
              e.preventDefault()
              focusItem('last')
            } else if (e.key === 'Escape') {
              e.preventDefault()
              close()
            } else if (e.key === 'Tab') {
              setOpen(false)
            }
          }}
        >
          {items.filter(Boolean).map((it, i) => {
            if (it.separator) return <div key={`sep-${i}`} className="menu-sep" role="separator" />
            if (it.heading) return <div key={`h-${i}`} className="menu-label" role="presentation">{it.heading}</div>
            const ItemIcon = it.icon
            return (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu-item ${it.danger ? 'danger' : ''}`}
                disabled={it.disabled}
                onClick={() => {
                  close(!it.keepFocusAway)
                  it.onSelect()
                }}
              >
                {ItemIcon && <ItemIcon aria-hidden="true" />}
                <span>{it.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
