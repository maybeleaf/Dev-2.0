import { BUDGET_COLORS } from '../data/categories.js'

/** Budget donut. Segments are drawn with stroke-dasharray on a single circle each. */
export function Donut({ lines, total, size = 220, stroke = 26, children, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = lines.filter((l) => l.amount > 0).length > 1 ? 3 : 0
  // Each segment starts where the previous one ended.
  const segments = []
  let offset = 0
  if (total > 0) {
    for (const l of lines) {
      if (l.amount <= 0) continue
      const len = (l.amount / total) * c
      segments.push({ key: l.key, len, offset })
      offset += len
    }
  }
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-3)" strokeWidth={stroke} />
        {segments.map((s) => (
          <circle
            key={s.key}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={BUDGET_COLORS[s.key]}
            strokeWidth={stroke}
            strokeDasharray={`${Math.max(0, s.len - gap)} ${c}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="donut-seg"
          />
        ))}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  )
}
