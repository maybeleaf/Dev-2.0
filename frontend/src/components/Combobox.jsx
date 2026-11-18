import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Accessible autocomplete (WAI-ARIA 1.2 combobox + listbox).
 * options: [{ value, label, sublabel?, keywords?, emoji? }]
 */
export function Combobox({ id, label, icon: Icon, options, value, onChange, placeholder, error, hint, emptyText = 'No matches — try a city or airport code', action }) {
  const listId = `${id}-list`
  const selected = options.find((o) => o.value === value) || null
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef(null)

  const results = useMemo(() => {
    const q = norm(query)
    if (!q) return options.slice(0, 60)
    return options
      .map((o) => {
        const l = norm(o.label)
        const hay = norm(`${o.label} ${o.sublabel || ''} ${o.keywords || ''} ${o.value}`)
        let score = 0
        if (norm(o.value) === q) score = 5
        else if (l.startsWith(q)) score = 4
        else if (hay.split(/[\s,()·/-]+/).some((w) => w.startsWith(q))) score = 2
        else if (hay.includes(q)) score = 1
        return { o, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.o.label.localeCompare(b.o.label))
      .slice(0, 8)
      .map((x) => x.o)
  }, [options, query])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, open])

  const commit = (o) => {
    onChange(o.value)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setActive(0)
      } else setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Home' && open) {
      setActive(0)
    } else if (e.key === 'End' && open) {
      setActive(results.length - 1)
    } else if (e.key === 'Enter') {
      if (open && results[active]) {
        e.preventDefault()
        commit(results[active])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Tab' && open && query && results[active]) {
      commit(results[active])
    }
  }

  const describedBy = [error && `${id}-error`, hint && !error && `${id}-hint`].filter(Boolean).join(' ') || undefined
  const activeId = open && results[active] ? `${id}-opt-${active}` : undefined

  return (
    <div className="field combobox">
      <label className="label" htmlFor={id}>
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </label>
      <div className="input-group">
        {selected?.emoji && !open ? (
          <span className="input-icon emoji" aria-hidden="true">
            {selected.emoji}
          </span>
        ) : (
          Icon && <Icon aria-hidden="true" />
        )}
        <input
          id={id}
          className="input"
          type="text"
          role="combobox"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          placeholder={open ? selected?.label || placeholder : placeholder}
          value={open ? query : selected ? selected.label : ''}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onClick={() => {
            if (!open) {
              setOpen(true)
              setActive(Math.max(0, results.findIndex((o) => o.value === value)))
            }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false)
            setQuery('')
          }}
        />
        {action && <div className="input-suffix">{action}</div>}
      </div>
      {open && (
        <ul className="combobox-list" id={listId} role="listbox" aria-label={label} ref={listRef}>
          {results.length === 0 && (
            <li className="combobox-empty" role="presentation">
              {emptyText}
            </li>
          )}
          {results.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              className={`combobox-option ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(o)}
            >
              {o.emoji && (
                <span className="emoji combobox-emoji" aria-hidden="true">
                  {o.emoji}
                </span>
              )}
              <span className="combobox-text">
                <span className="combobox-label">{o.label}</span>
                {o.sublabel && <span className="combobox-sub">{o.sublabel}</span>}
              </span>
              {o.badge && <span className="combobox-badge mono">{o.badge}</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {open && query ? `${results.length} result${results.length === 1 ? '' : 's'} available` : ''}
      </span>
      {hint && !error && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
