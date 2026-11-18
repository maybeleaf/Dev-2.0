// A paper plane's-eye view of the flight: a great-circle-ish arc with the plane
// placed (and rotated) at the current progress along a quadratic Bézier.

const W = 640
const H = 200
const P0 = [52, 168]
const P1 = [320, 8]
const P2 = [588, 168]
const PLANE =
  'M15 0c0-1.7-1.6-2.5-3.2-2.5H3.6L-3.6-11h-3.9l3.9 8.5h-6.6l-2.9-3.8h-2.6l1.8 6.3-1.8 6.3h2.6l2.9-3.8h6.6L-7.5 11h3.9l7.2-8.5h8.2C13.4 2.5 15 1.7 15 0z'

const bez = (t, i) => (1 - t) ** 2 * P0[i] + 2 * (1 - t) * t * P1[i] + t ** 2 * P2[i]
const tangent = (t, i) => 2 * (1 - t) * (P1[i] - P0[i]) + 2 * t * (P2[i] - P1[i])

export function FlightProgress({ flight: f, progress, remainingMs, fmt }) {
  const t = Math.min(1, Math.max(0, progress))
  const x = bez(t, 0)
  const y = bez(t, 1)
  const angle = (Math.atan2(tangent(t, 1), tangent(t, 0)) * 180) / Math.PI
  const d = `M${P0.join(' ')} Q${P1.join(' ')} ${P2.join(' ')}`
  const pct = Math.round(t * 100)
  const left = fmt.duration(remainingMs / 60000)
  return (
    <figure className="fp">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${f.from.city} to ${f.to.city}: ${pct}% of the way, ${left} to go.`}>
        <path d={d} className="fp-route" pathLength="1" />
        <path d={d} className="fp-done" pathLength="1" strokeDasharray={`${t} 1`} />
        <circle cx={P0[0]} cy={P0[1]} r="7" className="fp-end" />
        <circle cx={P2[0]} cy={P2[1]} r="7" className="fp-end fp-end-to" />
        <g className="fp-plane" transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}>
          <circle r="24" className="fp-glow" />
          <path d={PLANE} transform="scale(1.35)" />
        </g>
      </svg>
      <figcaption className="fp-ends">
        <span className="fp-endpoint">
          <span className="fp-code mono">{f.from.code}</span>
          <span className="fp-meta">
            {f.from.city} · left {fmt.time(f.depart, f.from.timezone)}
          </span>
        </span>
        <span className="fp-mid">
          <span className="fp-pct num">{pct}%</span>
          <span className="fp-meta">{left} to go</span>
        </span>
        <span className="fp-endpoint fp-endpoint-to">
          <span className="fp-code mono">{f.to.code}</span>
          <span className="fp-meta">
            {f.to.city} · lands {fmt.time(f.arrive, f.to.timezone)}
          </span>
        </span>
      </figcaption>
    </figure>
  )
}
