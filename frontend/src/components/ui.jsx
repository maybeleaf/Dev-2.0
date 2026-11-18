import { AlertCircle, Minus, Plus, Star } from 'lucide-react'

/** Emoji + label that follows the Emoji / Text / Both setting. The label is always read by screen readers. */
export function Glyph({ emoji, label, className = '' }) {
  return (
    <span className={`glyph ${className}`}>
      {emoji && (
        <span className="emoji" aria-hidden="true">
          {emoji}
        </span>
      )}
      <span className="glyph-label">{label}</span>
    </span>
  )
}

/** Purely decorative emoji (hidden in text-only mode and from screen readers). */
export function Emoji({ children, className = '' }) {
  return (
    <span className={`emoji ${className}`} aria-hidden="true">
      {children}
    </span>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const describedBy = (id, { hint, error } = {}) => [error && `${id}-error`, hint && !error && `${id}-hint`].filter(Boolean).join(' ') || undefined

export function Field({ id, label, icon: Icon, hint, error, children, className = '', as = 'div' }) {
  const Tag = as
  return (
    <Tag className={`field ${className}`}>
      <label className="label" htmlFor={id}>
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </label>
      {children}
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
    </Tag>
  )
}

export function Progress({ value, label, tone, size = '', className = '', valueText }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <div
      className={`progress ${size ? `progress-${size}` : ''} ${className}`}
      data-tone={tone}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
      style={{ '--p': v }}
    >
      <div className="progress-fill" />
    </div>
  )
}

export function Stepper({ id, value, min = 1, max = 6, onChange, label, unit = '' }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="btn btn-ghost" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${unit || label}`}>
        <Minus aria-hidden="true" />
      </button>
      <output id={id} aria-live="polite">
        {value}
      </output>
      <button type="button" className="btn btn-ghost" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${unit || label}`}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  )
}

/** Radio group styled as a segmented control. */
export function Segmented({ name, value, onChange, options, legend, block = false, className = '', hideLegend = false }) {
  return (
    <fieldset className={`fieldset ${className}`}>
      {legend && <legend className={hideLegend ? 'sr-only' : 'label'}>{legend}</legend>}
      <div className={`segmented ${block ? 'segmented-block' : ''}`}>
        {options.map((o) => (
          <label key={o.value} title={o.title}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.emoji ? <Glyph emoji={o.emoji} label={o.label} /> : o.icon ? <span className="glyph"><o.icon aria-hidden="true" width={16} height={16} />{o.label}</span> : o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Multi-select chips backed by real checkboxes. */
export function ChipGroup({ legend, options, values, onChange, name, hideLegend = false, className = '' }) {
  const toggle = (v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])
  return (
    <fieldset className={`fieldset ${className}`}>
      {legend && <legend className={hideLegend ? 'sr-only' : 'label'}>{legend}</legend>}
      <div className="chip-row">
        {options.map((o) => (
          <label key={o.value} className="chip">
            <input type="checkbox" name={name} value={o.value} checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
            <Glyph emoji={o.emoji} label={o.label} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Switch({ checked, onChange, label, description, id }) {
  return (
    <label className="switch" htmlFor={id}>
      <span className="switch-text">
        {label}
        {description && <span className="hint">{description}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function Rating({ value, reviews, className = '' }) {
  return (
    <span className={`rating ${className}`} aria-label={`Rated ${value.toFixed(1)} out of 5${reviews ? `, ${reviews} reviews` : ''}`}>
      <Star aria-hidden="true" className="rating-star" />
      <span aria-hidden="true">
        {value.toFixed(value >= 4.95 ? 1 : 2).replace(/0$/, '')}
        {reviews ? <span className="muted"> ({reviews})</span> : null}
      </span>
    </span>
  )
}

export function PriceLevel({ level = 1, className = '' }) {
  return (
    <span className={`price-level ${className}`} aria-label={`Price level ${level} of 4`}>
      <span aria-hidden="true">
        {'$'.repeat(level)}
        <span className="price-level-off">{'$'.repeat(4 - level)}</span>
      </span>
    </span>
  )
}

export function CategoryChip({ category, emoji, label, className = '' }) {
  return (
    <span className={`cat-chip ${className}`} style={{ '--c': `var(--cat-${category})` }}>
      <Glyph emoji={emoji} label={label} />
    </span>
  )
}
