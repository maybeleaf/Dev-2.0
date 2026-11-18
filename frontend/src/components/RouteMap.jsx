import { useMemo } from 'react'
import { fitProjection, haversineKm } from '../lib/geo.js'

const W = 420
const H = 360

const MODE_STYLE = {
  walk: { dash: '1 7', width: 3.2, color: 'var(--ink-2)' },
  transit: { dash: '', width: 3.2, color: 'var(--sky)' },
  taxi: { dash: '9 6', width: 3, color: 'var(--cat-shopping)' },
  tour: { dash: '14 8', width: 3.6, color: 'var(--cat-nature)' },
}

/**
 * Stylised map of one day: the stay, every stop in order, and the legs between
 * them (dotted = walk, solid = transit, dashed = taxi). No tiles, no API key.
 */
export function RouteMap({ schedule, dest, stay, activeKey, onHover, label }) {
  const geo = useMemo(() => {
    const stops = schedule.stops
    const pts = [stay.coords, ...stops.map((s) => s.act.coords)]
    const project = fitProjection(pts, W, H, 42)
    const home = project(stay.coords)
    const nodes = stops.map((s, i) => ({ key: s.key, n: i + 1, xy: project(s.act.coords), stop: s }))
    const legs = []
    let prev = home
    for (const node of nodes) {
      legs.push({ key: `l-${node.key}`, from: prev, to: node.xy, mode: node.stop.leg.mode, minutes: node.stop.leg.minutes })
      prev = node.xy
    }
    const back = schedule.entries.find((e) => e.key === 'leg-home')
    if (nodes.length) legs.push({ key: 'l-home', from: prev, to: home, mode: back?.mode || 'walk', home: true })
    const hoods = dest.neighborhoods
      .map((h) => ({ ...h, xy: project(h.coords) }))
      .filter((h) => h.xy[0] > 10 && h.xy[0] < W - 10 && h.xy[1] > 14 && h.xy[1] < H - 10)
    const spanKm = pts.length > 1 ? Math.max(...pts.map((p) => haversineKm(p, stay.coords))) : 0
    return { home, nodes, legs, hoods, spanKm }
  }, [schedule, dest, stay])

  const curve = (a, b, i) => {
    const mx = (a[0] + b[0]) / 2
    const my = (a[1] + b[1]) / 2
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const k = (i % 2 ? 1 : -1) * 0.12
    return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`
  }

  return (
    <figure className="route-map card">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <pattern id="rm-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="var(--line)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="var(--card-2)" />
        <rect width={W} height={H} fill="url(#rm-grid)" opacity="0.8" />
        {geo.hoods.map((h) => (
          <text key={h.name} x={h.xy[0]} y={h.xy[1]} className="rm-hood" textAnchor="middle">
            {h.name}
          </text>
        ))}
        {geo.legs.map((l, i) => {
          const st = MODE_STYLE[l.mode] || MODE_STYLE.walk
          return <path key={l.key} d={curve(l.from, l.to, i)} fill="none" stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" opacity={l.home ? 0.45 : 0.9} />
        })}
        <g className="rm-home" transform={`translate(${geo.home[0].toFixed(1)} ${geo.home[1].toFixed(1)})`}>
          <rect x="-13" y="-13" width="26" height="26" rx="7" fill="var(--ink)" />
          <path d="M-6 1 L0 -5 L6 1 V6 H-6 Z" fill="var(--paper)" />
        </g>
        {geo.nodes.map(({ key, n, xy, stop }) => {
          const active = key === activeKey
          return (
            <g
              key={key}
              className={`rm-node ${active ? 'is-active' : ''}`}
              transform={`translate(${xy[0].toFixed(1)} ${xy[1].toFixed(1)})`}
              onMouseEnter={() => onHover?.(key)}
              onMouseLeave={() => onHover?.(null)}
            >
              {active && <circle r="21" fill={`var(--cat-${stop.act.category})`} opacity="0.22" />}
              <circle r={active ? 15 : 12.5} fill={`var(--cat-${stop.act.category})`} stroke="var(--card)" strokeWidth="3" />
              <text y="4.5" textAnchor="middle" className="rm-num">
                {n}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="route-legend">
        <span>
          <span className="rm-key rm-key-home" aria-hidden="true" /> Your stay
        </span>
        <span>
          <svg width="26" height="8" aria-hidden="true">
            <path d="M2 4H24" stroke="var(--ink-2)" strokeWidth="3" strokeDasharray="1 6" strokeLinecap="round" />
          </svg>
          Walk
        </span>
        <span>
          <svg width="26" height="8" aria-hidden="true">
            <path d="M2 4H24" stroke="var(--sky)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Transit
        </span>
        <span>
          <svg width="26" height="8" aria-hidden="true">
            <path d="M2 4H24" stroke="var(--cat-shopping)" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" />
          </svg>
          Taxi
        </span>
        {geo.spanKm > 0 && <span className="muted">Up to {geo.spanKm < 10 ? geo.spanKm.toFixed(1) : Math.round(geo.spanKm)} km from your stay</span>}
      </figcaption>
    </figure>
  )
}
