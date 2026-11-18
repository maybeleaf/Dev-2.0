import { memo, useId, useMemo } from 'react'
import { createRng } from '../lib/random.js'

// Generative vintage travel posters. Every destination gets its own scene from
// its palette + id, so adding a destination needs no image assets at all.
// palette = [sky top, sky at horizon, sun, far layer, middle layer, foreground]

const H = 400
const WIDTHS = { poster: 300, square: 400, wide: 720, banner: 1100 }
const r1 = (n) => Math.round(n * 10) / 10

function catmull(pts) {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`
  }
  return d
}

function ridge(rng, W, baseY, amp, n, bottom = H) {
  const pts = []
  for (let i = 0; i <= n; i++) pts.push([(W * i) / n, baseY - amp * (0.25 + 0.75 * rng.next())])
  return `M0 ${bottom} L0 ${r1(pts[0][1])}${catmull(pts)} L${W} ${bottom} Z`
}

function peaks(rng, W, baseY, n, minH, maxH) {
  const step = W / n
  const pts = [[0, baseY - rng.range(0, minH * 0.5)]]
  const apexes = []
  for (let i = 0; i < n; i++) {
    const x0 = i * step
    const apex = [x0 + step * rng.range(0.35, 0.65), baseY - rng.range(minH, maxH)]
    const valley = [x0 + step, baseY - rng.range(0, minH * 0.45)]
    apexes.push({ left: pts[pts.length - 1], apex, right: valley })
    pts.push(apex, valley)
  }
  return { d: `M0 ${H} ${pts.map(([x, y]) => `L${r1(x)} ${r1(y)}`).join(' ')} L${W} ${H} Z`, apexes }
}

function snowcap({ left, apex, right }, k = 0.3) {
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const l = lerp(apex, left, k)
  const r = lerp(apex, right, k)
  const a = lerp(r, l, 0.25)
  const b = lerp(r, l, 0.5)
  const c = lerp(r, l, 0.75)
  return `M${r1(apex[0])} ${r1(apex[1])} L${r1(r[0])} ${r1(r[1])} L${r1(a[0])} ${r1(a[1] - 5)} L${r1(b[0])} ${r1(b[1] + 3)} L${r1(c[0])} ${r1(c[1] - 6)} L${r1(l[0])} ${r1(l[1])} Z`
}

function skyline(rng, W, baseY, { minW, maxW, minH, maxH, roofs = ['flat', 'flat', 'flat', 'step', 'spire', 'slant', 'dome'] }) {
  const out = []
  let x = -rng.range(0, maxW * 0.6)
  while (x < W) {
    const w = rng.range(minW, maxW)
    const h = rng.range(minH, maxH)
    out.push({ x, w, h, y: baseY - h, roof: rng.pick(roofs) })
    x += w - rng.range(0, 3)
  }
  return out
}

function buildingPath(bs, baseY) {
  return bs
    .map(({ x, w, y, roof }) => {
      let d = `M${r1(x)} ${baseY} V${r1(y)} H${r1(x + w)} V${baseY} Z`
      if (roof === 'step') d += ` M${r1(x + w * 0.2)} ${r1(y)} V${r1(y - 9)} H${r1(x + w * 0.8)} V${r1(y)} Z`
      if (roof === 'spire') d += ` M${r1(x + w / 2 - 3)} ${r1(y)} L${r1(x + w / 2)} ${r1(y - 26)} L${r1(x + w / 2 + 3)} ${r1(y)} Z`
      if (roof === 'slant') d += ` M${r1(x)} ${r1(y)} L${r1(x + w)} ${r1(y - 10)} V${r1(y)} Z`
      if (roof === 'dome') d += ` M${r1(x + w * 0.12)} ${r1(y)} C${r1(x + w * 0.12)} ${r1(y - w * 0.5)} ${r1(x + w * 0.88)} ${r1(y - w * 0.5)} ${r1(x + w * 0.88)} ${r1(y)} Z`
      return d
    })
    .join(' ')
}

function windowsPath(rng, bs, baseY, chance = 0.32) {
  let d = ''
  for (const b of bs) {
    for (let wx = b.x + 5; wx < b.x + b.w - 6; wx += 7) {
      for (let wy = b.y + 7; wy < baseY - 10; wy += 10) {
        if (rng.chance(chance)) d += `M${r1(wx)} ${r1(wy)} h3 v4 h-3 Z`
      }
    }
  }
  return d
}

function Sun({ cx, cy, r, fill, stripes, skyId }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} />
      {stripes &&
        [0, 1, 2, 3].map((i) => (
          <rect key={i} x={cx - r - 2} y={r1(cy + r * 0.18 + i * r * 0.21)} width={r * 2 + 4} height={r1(r * 0.05 + i * r * 0.03)} fill={`url(#${skyId})`} />
        ))}
    </g>
  )
}

function glitter(rng, cx, r, y0, color) {
  return Array.from({ length: 6 }, (_, i) => {
    const w = r * 1.5 * (1 - i * 0.13)
    return <rect key={i} x={r1(cx - w / 2 + rng.range(-6, 6))} y={y0 + 7 + i * 9} width={r1(w)} height={2.4} rx={1.2} fill={color} opacity={0.7 - i * 0.07} />
  })
}

function waves(rng, W, y0, y1, color, opacity = 0.28) {
  let d = ''
  for (let y = y0; y < y1; y += 15) {
    for (let x = rng.range(-20, 0); x < W; x += rng.range(28, 52)) {
      const len = rng.range(8, 22)
      d += `M${r1(x)} ${r1(y + rng.range(-2, 2))} h${r1(len)} `
    }
  }
  return <path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={opacity} fill="none" />
}

function palm(x, baseY, height, lean, color, rng) {
  const topX = x + lean
  const topY = baseY - height
  const trunk = `M${x - 5} ${baseY} Q${x + lean * 0.2} ${baseY - height * 0.55} ${topX - 3} ${topY} L${topX + 3} ${topY} Q${x + lean * 0.2 + 8} ${baseY - height * 0.55} ${x + 5} ${baseY} Z`
  const leaves = [-150, -120, -85, -50, -20, 15, 200].map((deg, i) => {
    const len = rng.range(48, 68)
    const a = ((deg + rng.range(-8, 8)) * Math.PI) / 180
    const tx = topX + Math.cos(a) * len
    const ty = topY + Math.sin(a) * len * 0.75 + len * 0.28
    const nx = -Math.sin(a) * 9
    const ny = Math.cos(a) * 9
    const mx = (topX + tx) / 2
    const my = (topY + ty) / 2 - len * 0.18
    return <path key={i} d={`M${r1(topX)} ${r1(topY)} Q${r1(mx + nx)} ${r1(my + ny)} ${r1(tx)} ${r1(ty)} Q${r1(mx - nx)} ${r1(my - ny)} ${r1(topX)} ${r1(topY)} Z`} fill={color} />
  })
  return (
    <g>
      <path d={trunk} fill={color} />
      {leaves}
    </g>
  )
}

function frond(sx, sy, ex, ey, color, side = 1) {
  const n = 11
  const lines = []
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1)
    const x = sx + (ex - sx) * t
    const y = sy + (ey - sy) * t + Math.sin(t * Math.PI) * 18
    const len = 38 * (1 - t * 0.6)
    lines.push(`M${r1(x)} ${r1(y)} l${r1(-side * len * 0.35)} ${r1(len)}`)
    lines.push(`M${r1(x)} ${r1(y)} l${r1(side * len * 0.5)} ${r1(len * 0.85)}`)
  }
  const spine = `M${sx} ${sy} Q${r1((sx + ex) / 2)} ${r1((sy + ey) / 2 + 30)} ${ex} ${ey}`
  return (
    <g stroke={color} strokeLinecap="round" fill="none">
      <path d={spine} strokeWidth={6} />
      <path d={lines.join(' ')} strokeWidth={5} />
    </g>
  )
}

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

// ——— Scenes ———
const SCENES = {
  coast({ W, rng, p, skyId }) {
    const horizon = 268
    const sun = { cx: r1(W * rng.range(0.56, 0.7)), cy: 172, r: 54 }
    const cw = Math.min(W * 0.46, 180)
    const boats = Array.from({ length: Math.max(1, Math.round(W / 280)) }, (_, i) => ({
      x: r1(cw + 30 + ((W - cw - 60) * (i + rng.range(0.2, 0.8))) / Math.max(1, Math.round(W / 280))),
      y: horizon + rng.range(22, 52),
      s: rng.range(0.8, 1.15),
    }))
    const houses = []
    for (let x = 4; x < cw * 0.5; x += rng.range(17, 23)) houses.push({ x, w: rng.range(14, 19), h: rng.range(13, 20), base: 292 + (x / (cw * 0.55)) * 10 + 3 })
    const lx = cw * 0.62
    const ly = 300
    return (
      <>
        <Sun {...sun} fill={p.sun} stripes skyId={skyId} />
        <path d={ridge(rng, W, 254, 26, Math.max(4, Math.round(W / 70)))} fill={p.far} />
        <rect x={0} y={horizon} width={W} height={H - horizon} fill={p.mid} />
        {waves(rng, W, horizon + 12, H, p.horizon)}
        {glitter(rng, sun.cx, sun.r, horizon, p.sun)}
        {boats.map((b, i) => (
          <g key={i} transform={`translate(${b.x} ${r1(b.y)}) scale(${r1(b.s * 10) / 10})`}>
            <path d="M-16 0 H16 L11 6 H-11 Z" fill={p.fore} />
            <path d="M1 -1 V-30 L15 -3 Z" fill={p.sun} />
            <path d="M-1 -3 V-24 L-12 -4 Z" fill={p.horizon} />
          </g>
        ))}
        {houses.map((h, i) => (
          <g key={i}>
            <rect x={r1(h.x)} y={r1(h.base - h.h)} width={r1(h.w)} height={r1(h.h + 6)} fill={p.horizon} />
            <path d={`M${r1(h.x - 2)} ${r1(h.base - h.h)} L${r1(h.x + h.w / 2)} ${r1(h.base - h.h - 8)} L${r1(h.x + h.w + 2)} ${r1(h.base - h.h)} Z`} fill={p.far} />
            <rect x={r1(h.x + h.w / 2 - 2)} y={r1(h.base - h.h + 4)} width={4} height={5} fill={p.fore} opacity={0.75} />
          </g>
        ))}
        <path d={`M${r1(lx)} ${ly - 67} L${r1(lx + 120)} ${ly - 90} L${r1(lx + 120)} ${ly - 50} Z`} fill={p.sun} opacity={0.22} />
        <path d={`M${r1(lx - 8)} ${ly + 2} L${r1(lx - 5)} ${ly - 62} H${r1(lx + 5)} L${r1(lx + 8)} ${ly + 2} Z`} fill={p.horizon} />
        <path d={`M${r1(lx - 7.2)} ${ly - 14} H${r1(lx + 7.2)} L${r1(lx + 6.7)} ${ly - 26} H${r1(lx - 6.7)} Z M${r1(lx - 6.2)} ${ly - 38} H${r1(lx + 6.2)} L${r1(lx + 5.7)} ${ly - 50} H${r1(lx - 5.7)} Z`} fill={p.far} />
        <rect x={r1(lx - 5)} y={ly - 72} width={10} height={10} fill={p.sun} />
        <path d={`M${r1(lx - 7)} ${ly - 72} L${r1(lx)} ${ly - 82} L${r1(lx + 7)} ${ly - 72} Z M${r1(lx - 7)} ${ly - 62} H${r1(lx + 7)} V${ly - 60} H${r1(lx - 7)} Z`} fill={p.fore} />
        <path d={`M0 290 L${r1(cw * 0.55)} 300 Q${r1(cw * 0.86)} 305 ${r1(cw * 0.95)} 345 L${r1(cw)} ${H} L0 ${H} Z`} fill={p.fore} />
      </>
    )
  },

  city({ W, rng, p }) {
    const far = skyline(rng, W, 300, { minW: 16, maxW: 32, minH: 36, maxH: 112 })
    const mid = skyline(rng, W, 326, { minW: 26, maxW: 46, minH: 48, maxH: 128, roofs: ['flat', 'flat', 'step', 'slant', 'dome', 'flat'] })
    const tx = r1(W * rng.range(0.6, 0.72))
    const sun = { cx: r1(W * rng.range(0.2, 0.32)), cy: 150, r: 44 }
    const spans = []
    const spanW = 92
    for (let x = -rng.range(10, 60); x < W; x += spanW) spans.push(x)
    return (
      <>
        <Sun {...sun} fill={p.sun} />
        <path d={buildingPath(far, 300)} fill={p.far} />
        <path d={`M${tx - 26} 300 Q${tx - 8} 230 ${tx - 4} 150 H${tx + 4} Q${tx + 8} 230 ${tx + 26} 300 H${tx + 15} Q${tx} 272 ${tx - 15} 300 Z M${tx - 2} 150 L${tx} 92 L${tx + 2} 150 Z M${tx - 15} 252 H${tx + 15} V258 H${tx - 15} Z M${tx - 9} 200 H${tx + 9} V205 H${tx - 9} Z`} fill={p.mid} />
        <path d={buildingPath(mid, 326)} fill={p.mid} />
        <path d={windowsPath(rng, mid, 326)} fill={p.horizon} opacity={0.75} />
        <rect x={0} y={326} width={W} height={H - 326} fill={p.horizon} />
        {waves(rng, W, 352, H, p.far, 0.55)}
        <path
          d={`M0 316 H${W} V327 H0 Z ${spans
            .map((x) => `M${r1(x + 7)} 327 H${r1(x + spanW - 7)} V392 Q${r1(x + spanW / 2)} 318 ${r1(x + 7)} 392 Z M${r1(x - 7)} 327 H${r1(x + 7)} V${H} H${r1(x - 7)} Z`)
            .join(' ')}`}
          fill={p.fore}
        />
        {spans.map((x, i) => (
          <g key={i}>
            <rect x={r1(x + spanW / 2 - 1)} y={300} width={2} height={16} fill={p.fore} />
            <circle cx={r1(x + spanW / 2)} cy={299} r={3.2} fill={p.sun} />
          </g>
        ))}
      </>
    )
  },

  mountains({ W, rng, p, dest }) {
    const darkSky = luminance(p.skyTop) < 0.18
    const aurora = dest.vibes.includes('cold')
    const range = peaks(rng, W, 262, Math.max(3, Math.round(W / 95)), 70, 148)
    const pines = []
    for (let x = rng.range(-10, 6); x < W + 10; x += rng.range(12, 26)) {
      if (Math.abs(x - W * 0.74) < 26) continue
      pines.push({ x, h: rng.range(26, 62), base: 356 + rng.range(-4, 6) })
    }
    const cabin = W * 0.74
    return (
      <>
        {darkSky &&
          Array.from({ length: Math.round(W / 9) }, (_, i) => <circle key={i} cx={r1(rng.range(0, W))} cy={r1(rng.range(10, 170))} r={r1(rng.range(0.6, 1.6))} fill={p.sun} opacity={r1(rng.range(0.4, 0.9))} />)}
        {aurora && (
          <g fill="none" strokeLinecap="round">
            {[0, 1].map((k) => {
              const y = 70 + k * 42
              const d = `M-20 ${y + 30} C${r1(W * 0.25)} ${y - 30}, ${r1(W * 0.45)} ${y + 50}, ${r1(W * 0.7)} ${y} S${r1(W * 1.05)} ${y + 10}, ${r1(W + 20)} ${y - 20}`
              return (
                <g key={k}>
                  <path d={d} stroke={p.sun} strokeWidth={34} opacity={0.12} />
                  <path d={d} stroke={p.sun} strokeWidth={12} opacity={0.22} strokeDasharray="2 5" />
                </g>
              )
            })}
          </g>
        )}
        <Sun cx={r1(W * 0.62)} cy={170} r={38} fill={p.sun} />
        <path d={range.d} fill={p.far} />
        {range.apexes.map((a, i) => (
          <path key={i} d={snowcap(a)} fill={p.sun} opacity={0.92} />
        ))}
        <path d={ridge(rng, W, 292, 36, Math.max(3, Math.round(W / 110)), 306)} fill={p.mid} />
        <rect x={0} y={302} width={W} height={H - 302} fill={p.horizon} />
        <path d={`M${r1(W * 0.62 - 26)} 312 h52 M${r1(W * 0.62 - 18)} 322 h36 M${r1(W * 0.62 - 10)} 332 h20`} stroke={p.sun} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        {waves(rng, W, 316, 350, p.mid, 0.35)}
        <path d={ridge(rng, W, 352, 12, Math.max(3, Math.round(W / 120)))} fill={p.fore} />
        <path
          d={pines
            .map(({ x, h, base }) =>
              [0, 1, 2]
                .map((t) => {
                  const ty = base - h * (0.3 + t * 0.3)
                  const tw = (h * (0.42 - t * 0.1)) / 2
                  return `M${r1(x - tw)} ${r1(ty + h * 0.34)} L${r1(x)} ${r1(ty - h * 0.08)} L${r1(x + tw)} ${r1(ty + h * 0.34)} Z`
                })
                .join(' ') + ` M${r1(x - 1.5)} ${r1(base)} h3 v-${r1(h * 0.2)} h-3 Z`,
            )
            .join(' ')}
          fill={p.fore}
        />
        <path d={`M${r1(cabin - 20)} 352 V334 L${r1(cabin)} 318 L${r1(cabin + 20)} 334 V352 Z`} fill={p.fore} />
        <rect x={r1(cabin - 6)} y={336} width={8} height={7} fill={p.sun} />
        <path d={`M${r1(cabin + 9)} 326 v-10 h5 v14`} fill={p.fore} />
      </>
    )
  },

  desert({ W, rng, p, skyId }) {
    const sun = { cx: r1(W * rng.range(0.42, 0.58)), cy: 196, r: 66 }
    const mx = r1(W * rng.range(0.68, 0.78))
    const gate = r1(W * rng.range(0.22, 0.34))
    let wall = 'M0 286 H' + W + ` V${H} H0 Z`
    for (let x = 0; x < W; x += 13) wall += ` M${x} 286 v-7 h7 v7 Z`
    const palms = Array.from({ length: Math.max(2, Math.round(W / 220)) }, (_, i) => ({
      x: r1(((i + 0.5) * W) / Math.max(2, Math.round(W / 220)) + rng.range(-30, 30) - (i === 0 ? W * 0.18 : 0)),
      h: rng.range(110, 150),
      lean: rng.range(-28, 28),
    }))
    return (
      <>
        <Sun {...sun} fill={p.sun} stripes skyId={skyId} />
        <path d={ridge(rng, W, 268, 24, Math.max(3, Math.round(W / 120)))} fill={p.far} />
        <path d={wall} fill={p.mid} />
        <path d={`M${mx - 9} 286 V176 H${mx + 9} V286 Z M${mx - 13} 176 V168 H${mx + 13} V176 Z M${mx - 5} 168 V150 H${mx + 5} V168 Z M${mx - 5} 150 Q${mx} 136 ${mx + 5} 150 Z M${mx - 0.8} 140 V128 H${mx + 0.8} V140 Z`} fill={p.mid} />
        <circle cx={mx} cy={126} r={2.6} fill={p.mid} />
        <path d={`M${mx - 4} 200 v-8 q4 -6 8 0 v8 Z M${mx - 4} 236 v-8 q4 -6 8 0 v8 Z`} fill={p.horizon} opacity={0.55} />
        <path d={`M${gate - 16} 330 V304 Q${gate - 16} 286 ${gate} 286 Q${gate + 16} 286 ${gate + 16} 304 V330 Z`} fill={p.fore} opacity={0.5} />
        <path d={`M${r1(W * 0.5 - 30)} 286 C${r1(W * 0.5 - 30)} 254 ${r1(W * 0.5 + 30)} 254 ${r1(W * 0.5 + 30)} 286 Z`} fill={p.mid} />
        <path d={ridge(rng, W, 350, 10, 3)} fill={p.fore} />
        {palms.map((pm, i) => (
          <g key={i}>{palm(pm.x, 364, pm.h, pm.lean, p.fore, rng)}</g>
        ))}
      </>
    )
  },

  tropical({ W, rng, p, skyId }) {
    const sun = { cx: r1(W * rng.range(0.24, 0.34)), cy: 168, r: 50 }
    const vx = r1(W * rng.range(0.62, 0.72))
    const bands = [0, 1, 2, 3, 4, 5].map((i) => {
      const y0 = 268 + i * 17
      const k = i % 2 ? 1 : -1
      return `M0 ${y0} C${r1(W * 0.3)} ${y0 - 14 * k} ${r1(W * 0.7)} ${y0 + 12 * k} ${W} ${y0 - 4} V${H} H0 Z`
    })
    return (
      <>
        <Sun {...sun} fill={p.sun} stripes skyId={skyId} />
        <path d={ridge(rng, W, 262, 18, Math.max(3, Math.round(W / 100)))} fill={p.far} />
        <path d={`M${vx - 140} 270 L${vx - 28} 178 Q${vx} 168 ${vx + 28} 178 L${vx + 140} 270 Z`} fill={p.far} />
        <g fill={p.horizon} opacity={0.75}>
          <circle cx={vx - 8} cy={160} r={9} />
          <circle cx={vx + 6} cy={150} r={12} />
          <circle cx={vx + 22} cy={142} r={8} />
        </g>
        {bands.map((d, i) => (
          <path key={i} d={d} fill={p.mid} stroke={p.horizon} strokeOpacity={0.38} strokeWidth={2} />
        ))}
        <path d={ridge(rng, W, 372, 10, 3)} fill={p.fore} />
        {palm(r1(W - Math.min(W * 0.16, 70)), 380, 190, -40, p.fore, rng)}
        {frond(-10, 18, r1(Math.min(W * 0.5, 170)), 96, p.fore, 1)}
        {frond(-10, 70, r1(Math.min(W * 0.36, 120)), 150, p.fore, 1)}
      </>
    )
  },

  domes({ W, rng, p }) {
    const sun = { cx: r1(W * rng.range(0.66, 0.78)), cy: 150, r: 42 }
    const low = skyline(rng, W, 272, { minW: 18, maxW: 36, minH: 10, maxH: 30, roofs: ['flat', 'flat', 'dome', 'slant'] })
    const mosques = [{ x: r1(W * rng.range(0.36, 0.46)), s: 1 }]
    if (W > 500) mosques.push({ x: r1(W * 0.82), s: 0.72 })
    const near = skyline(rng, W, H, { minW: 30, maxW: 56, minH: 40, maxH: 72, roofs: ['flat', 'dome', 'flat', 'slant'] })
    const birds = Array.from({ length: 4 + Math.round(W / 200) }, () => ({ x: rng.range(20, W - 20), y: rng.range(60, 130), s: rng.range(0.7, 1.2) }))
    const fx = r1(W * rng.range(0.14, 0.24))
    return (
      <>
        <Sun {...sun} fill={p.sun} />
        <path d={birds.map((b) => `M${r1(b.x - 7 * b.s)} ${r1(b.y)} q${r1(3.5 * b.s)} ${r1(-5 * b.s)} ${r1(7 * b.s)} 0 q${r1(3.5 * b.s)} ${r1(-5 * b.s)} ${r1(7 * b.s)} 0`).join(' ')} stroke={p.fore} strokeWidth={2} fill="none" opacity={0.55} strokeLinecap="round" />
        <path d={buildingPath(low, 272)} fill={p.far} />
        {mosques.map(({ x, s }, i) => (
          <g key={i} transform={`translate(${x} 272) scale(${s}) translate(${-x} -272)`} fill={p.far}>
            <rect x={x - 60} y={238} width={120} height={34} />
            <path d={`M${x - 36} 238 C${x - 36} 192 ${x + 36} 192 ${x + 36} 238 Z M${x - 1} 204 V186 H${x + 1} V204 Z`} />
            <path d={`M${x - 64} 246 C${x - 64} 222 ${x - 30} 222 ${x - 30} 246 Z M${x + 30} 246 C${x + 30} 222 ${x + 64} 222 ${x + 64} 246 Z`} />
            {[-78, -58, 58, 78].map((dx) => (
              <path key={dx} d={`M${x + dx - 3} 272 V${dx % 78 === 0 ? 162 : 176} H${x + dx + 3} V272 Z M${x + dx - 3} ${dx % 78 === 0 ? 162 : 176} L${x + dx} ${dx % 78 === 0 ? 138 : 154} L${x + dx + 3} ${dx % 78 === 0 ? 162 : 176} Z M${x + dx - 5} ${dx % 78 === 0 ? 196 : 206} h10 v3 h-10 Z`} />
            ))}
          </g>
        ))}
        <rect x={0} y={272} width={W} height={H - 272} fill={p.mid} />
        {waves(rng, W, 284, 340, p.horizon, 0.32)}
        <g transform={`translate(${fx} 306)`}>
          <path d="M-30 0 H30 L24 9 H-24 Z" fill={p.fore} />
          <rect x={-18} y={-9} width={34} height={9} fill={p.horizon} />
          <rect x={-4} y={-19} width={6} height={10} fill={p.sun} />
        </g>
        <path d={buildingPath(near, H)} fill={p.fore} />
        <path d={windowsPath(rng, near, H, 0.18)} fill={p.sun} opacity={0.85} />
      </>
    )
  },

  temple({ W, rng, p, dest }) {
    const sun = { cx: r1(W * rng.range(0.58, 0.68)), cy: 158, r: 52 }
    const px = r1(W * rng.range(0.28, 0.38))
    const cone = dest.countryCode === 'JP' || dest.vibes.includes('mountains')
    const tiers = 5
    const tierH = 25
    let pagoda = ''
    for (let i = 0; i < tiers; i++) {
      const w = 74 - i * 11
      const y = 306 - i * tierH
      pagoda += ` M${r1(px - w * 0.36)} ${y} V${y - tierH + 10} H${r1(px + w * 0.36)} V${y} Z`
      pagoda += ` M${r1(px - w / 2 - 12)} ${y - tierH + 12} C${r1(px - w / 2 - 2)} ${y - tierH + 8} ${r1(px - w / 2 + 4)} ${y - tierH + 2} ${r1(px - w / 2 + 10)} ${y - tierH} H${r1(px + w / 2 - 10)} C${r1(px + w / 2 - 4)} ${y - tierH + 2} ${r1(px + w / 2 + 2)} ${y - tierH + 8} ${r1(px + w / 2 + 12)} ${y - tierH + 12} Z`
    }
    const topY = 306 - tiers * tierH
    pagoda += ` M${px - 1.5} ${topY} V${topY - 30} H${px + 1.5} V${topY} Z`
    const hx = r1(Math.min(W * 0.76, px + 150))
    const blossoms = Array.from({ length: 16 + Math.round(W / 60) }, () => {
      const t = rng.next()
      return { x: W + 6 - t * 160 + rng.range(-14, 14), y: 18 + t * 74 + rng.range(-16, 18), r: rng.range(3.5, 7) }
    })
    return (
      <>
        <Sun {...sun} fill={p.sun} />
        {cone && (
          <g>
            <path d={`M${r1(W * 0.12 - 150)} 278 L${r1(W * 0.12 - 18)} 170 Q${r1(W * 0.12)} 162 ${r1(W * 0.12 + 18)} 170 L${r1(W * 0.12 + 150)} 278 Z`} fill={p.far} />
            <path d={`M${r1(W * 0.12 - 32)} 196 L${r1(W * 0.12 - 18)} 170 Q${r1(W * 0.12)} 162 ${r1(W * 0.12 + 18)} 170 L${r1(W * 0.12 + 32)} 196 L${r1(W * 0.12 + 18)} 190 L${r1(W * 0.12 + 6)} 200 L${r1(W * 0.12 - 8)} 188 L${r1(W * 0.12 - 20)} 198 Z`} fill={p.horizon} />
          </g>
        )}
        <path d={ridge(rng, W, 284, 22, Math.max(3, Math.round(W / 90)))} fill={p.far} />
        <path d={pagoda} fill={p.mid} />
        <path d={`M${px - 3} ${topY - 22} h6 v2 h-6 Z M${px - 3} ${topY - 15} h6 v2 h-6 Z`} fill={p.mid} />
        <path d={`M${hx - 70} 306 C${hx - 52} 300 ${hx - 40} 288 ${hx - 34} 278 H${hx + 34} C${hx + 40} 288 ${hx + 52} 300 ${hx + 70} 306 Z M${hx - 46} 306 V326 H${hx + 46} V306 Z M${hx - 24} 278 C${hx - 20} 270 ${hx - 14} 266 ${hx - 10} 262 H${hx + 10} C${hx + 14} 266 ${hx + 20} 270 ${hx + 24} 278 Z`} fill={p.mid} opacity={0.9} />
        <rect x={0} y={306} width={W} height={H - 306} fill={p.mid} />
        <path d={ridge(rng, W, 354, 10, Math.max(3, Math.round(W / 120)))} fill={p.fore} />
        {[0.12, 0.56, 0.9].map((k, i) => {
          const x = r1(W * k)
          return <path key={i} d={`M${x - 8} 352 h16 v-4 h-4 v-10 h6 l-10 -8 l-10 8 h6 v10 h-4 Z`} fill={p.fore} />
        })}
        <g stroke={p.fore} strokeLinecap="round" fill="none">
          <path d={`M${W + 10} 14 Q${W - 70} 30 ${W - 168} 96`} strokeWidth={6} />
          <path d={`M${W - 60} 32 Q${W - 80} 60 ${W - 112} 70 M${W - 112} 60 Q${W - 128} 40 ${W - 146} 38`} strokeWidth={3.5} />
        </g>
        {blossoms.map((b, i) => (
          <g key={i}>
            <circle cx={r1(b.x)} cy={r1(b.y)} r={r1(b.r)} fill={p.horizon} />
            <circle cx={r1(b.x)} cy={r1(b.y)} r={1.6} fill={p.sun} />
          </g>
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <ellipse key={i} cx={r1(W - 60 - rng.range(0, 200))} cy={r1(rng.range(120, 260))} rx={3.2} ry={1.8} transform={`rotate(${r1(rng.range(-40, 40))})`} fill={p.horizon} opacity={0.8} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        ))}
      </>
    )
  },
}

/** Deterministic for a destination and width: the same inputs always draw the same scene. */
function drawScene(dest, W, skyId) {
  const [skyTop, horizon, sun, far, mid, fore] = dest.poster.palette
  const scene = SCENES[dest.poster.scene] || SCENES.coast
  return scene({ W, rng: createRng(`${dest.id}|poster|${W}`), p: { skyTop, horizon, sun, far, mid, fore }, skyId, dest })
}

function PosterArt({ dest, ratio = 'poster', className = '', label, children }) {
  const rawId = useId()
  const id = `p${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const W = WIDTHS[ratio] || WIDTHS.poster
  const [skyTop, horizon, sun, , , fore] = dest.poster.palette
  const skyId = `${id}-sky`
  const art = useMemo(() => drawScene(dest, W, skyId), [dest, W, skyId])
  return (
    <div className={`poster grain ${className}`} data-ratio={ratio} style={{ '--poster-ink': fore, '--poster-sky': skyTop, '--poster-sun': sun, '--poster-horizon': horizon }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2={H * 0.72} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={horizon} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#${skyId})`} />
        {art}
      </svg>
      {children}
    </div>
  )
}

export const Poster = memo(PosterArt)
export default Poster
