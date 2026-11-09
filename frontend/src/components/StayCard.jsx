import { memo, useId, useMemo } from 'react'
import { BadgeCheck, Check, MapPin, Users } from 'lucide-react'
import { AMENITIES } from '../data/categories.js'
import { stayTotal } from '../engine/stays.js'
import { createRng } from '../lib/random.js'
import { Glyph, Rating } from './ui.jsx'

/** A generated "listing photo": a little room scene in the destination's palette. */
export const StayArt = memo(function StayArt({ stay, dest }) {
  const raw = useId()
  const id = `sa${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [skyTop, horizon, sun, far, mid, fore] = dest.poster.palette
  const art = useMemo(() => {
    const rng = createRng(`${stay.id}|${dest.id}|art`)
    const k = stay.typeKey
    const wx = rng.range(150, 210)
    const ww = rng.range(84, 104)
    const isRiad = k.startsWith('riad')
    const isRyokan = k === 'ryokan'
    const isWood = ['cabin', 'chalet', 'lodge'].includes(k)
    const isTropic = ['villa', 'bungalow'].includes(k)
    const wall = isWood ? far : rng.pick([horizon, horizon, '#fbf6ec'])
    const bedX = rng.range(14, 40)
    return { wx, ww, isRiad, isRyokan, isWood, isTropic, wall, bedX, plantX: rng.range(262, 290), lamp: rng.chance(0.6), rug: rng.chance(0.5) }
  }, [stay.id, stay.typeKey, dest.id, far, horizon])
  const { wx, ww, isRiad, isRyokan, isWood, isTropic, wall, bedX, plantX, lamp, rug } = art
  const winTop = 34
  const winH = 82
  return (
    <svg className="stay-art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="1" stopColor={horizon} />
        </linearGradient>
        <clipPath id={`${id}-win`}>
          {isRiad ? <path d={`M${wx} ${winTop + winH} V${winTop + 30} Q${wx} ${winTop} ${wx + ww / 2} ${winTop} Q${wx + ww} ${winTop} ${wx + ww} ${winTop + 30} V${winTop + winH} Z`} /> : <rect x={wx} y={winTop} width={ww} height={winH} rx={isTropic ? 2 : 4} />}
        </clipPath>
      </defs>
      <rect width="320" height="200" fill={wall} />
      {isWood && <path d={Array.from({ length: 9 }, (_, i) => `M0 ${14 + i * 17} H320`).join(' ')} stroke={fore} strokeOpacity="0.18" strokeWidth="2" />}
      <g clipPath={`url(#${id}-win)`}>
        <rect x={wx} y={winTop} width={ww} height={winH} fill={`url(#${id}-sky)`} />
        <circle cx={wx + ww * 0.7} cy={winTop + 26} r="11" fill={sun} />
        {isWood || dest.poster.scene === 'mountains' ? (
          <path d={`M${wx - 4} ${winTop + winH} L${wx + ww * 0.3} ${winTop + 36} L${wx + ww * 0.55} ${winTop + 58} L${wx + ww * 0.78} ${winTop + 30} L${wx + ww + 4} ${winTop + winH} Z`} fill={mid} />
        ) : isTropic || dest.poster.scene === 'coast' || dest.poster.scene === 'tropical' ? (
          <rect x={wx} y={winTop + winH * 0.62} width={ww} height={winH} fill={mid} />
        ) : (
          <path d={`M${wx} ${winTop + winH} V${winTop + 52} h12 v-14 h14 v22 h10 v-30 h16 v20 h12 v-8 h${ww} V${winTop + winH} Z`} fill={far} />
        )}
      </g>
      {isRyokan ? (
        <path d={`M${wx} ${winTop} h${ww} v${winH} h-${ww} Z M${wx + ww / 3} ${winTop} v${winH} M${wx + (2 * ww) / 3} ${winTop} v${winH} M${wx} ${winTop + winH / 3} h${ww} M${wx} ${winTop + (2 * winH) / 3} h${ww}`} fill="none" stroke={fore} strokeWidth="3" />
      ) : isRiad ? (
        <path d={`M${wx} ${winTop + winH} V${winTop + 30} Q${wx} ${winTop} ${wx + ww / 2} ${winTop} Q${wx + ww} ${winTop} ${wx + ww} ${winTop + 30} V${winTop + winH} Z`} fill="none" stroke={fore} strokeWidth="5" />
      ) : (
        <path d={`M${wx} ${winTop} h${ww} v${winH} h-${ww} Z M${wx + ww / 2} ${winTop} v${winH}`} fill="none" stroke={fore} strokeWidth="4" />
      )}
      <rect y="148" width="320" height="52" fill={isRyokan ? '#d9c9a3' : isRiad ? mid : far} />
      {isRyokan && <path d="M0 162 H320 M0 178 H320 M80 148 V200 M200 148 V200" stroke={fore} strokeOpacity="0.25" strokeWidth="2" />}
      {isRiad && <path d={Array.from({ length: 12 }, (_, i) => `M${i * 28 + 10} 160 l6 6 l-6 6 l-6 -6 Z`).join(' ')} fill={sun} opacity="0.55" />}
      {rug && !isRyokan && <ellipse cx={bedX + 70} cy="178" rx="70" ry="10" fill={sun} opacity="0.45" />}
      <rect x={bedX} y="112" width="128" height="40" rx="6" fill="#fffdf8" />
      <rect x={bedX} y="96" width="12" height="56" rx="3" fill={fore} />
      <rect x={bedX + 16} y="104" width="32" height="16" rx="6" fill="#ffffff" stroke={fore} strokeOpacity="0.15" />
      <path d={`M${bedX + 54} 116 h74 v36 h-74 Z`} fill={mid} opacity="0.85" />
      {lamp && (
        <g>
          <rect x={bedX + 140} y="128" width="22" height="24" rx="3" fill={fore} opacity="0.85" />
          <path d={`M${bedX + 151} 128 V104`} stroke={fore} strokeWidth="2.5" />
          <path d={`M${bedX + 141} 106 h20 l-4 -14 h-12 Z`} fill={sun} />
        </g>
      )}
      <g transform={`translate(${plantX} 120)`}>
        <path d="M-10 30 h20 l-3 22 h-14 Z" fill={fore} opacity="0.9" />
        <path d="M0 30 C-16 18 -14 4 -4 -6 C-2 8 0 18 0 30 Z M0 30 C14 20 18 6 10 -4 C6 10 2 20 0 30 Z M0 30 C-4 14 0 0 6 -12 C8 4 4 18 0 30 Z" fill={isTropic ? mid : '#4f7f5a'} />
      </g>
      {isTropic && <rect x="0" y="182" width="320" height="18" fill="#7cc4d6" opacity="0.8" />}
    </svg>
  )
})


export function StayCard({ stay, dest, fmt, nights, travelers, selected, onSelect, headingLevel = 3 }) {
  const H = `h${headingLevel}`
  const total = stayTotal(stay, nights)
  const tooSmall = stay.capacity < travelers
  return (
    <article className={`stay-card card ${selected ? 'is-selected' : ''}`}>
      <div className="stay-media">
        <StayArt stay={stay} dest={dest} />
        {stay.superhost && (
          <span className="badge stay-badge">
            <BadgeCheck aria-hidden="true" /> Superhost
          </span>
        )}
        <span className={`stay-tier tier-${stay.tier}`}>{stay.tier === 'budget' ? '$' : stay.tier === 'mid' ? '$$' : '$$$'}</span>
      </div>
      <div className="stay-body">
        <p className="stay-kicker">
          {stay.type} · <MapPin aria-hidden="true" className="icon-inline" /> {stay.neighborhood}
        </p>
        <H className="stay-title">{stay.title}</H>
        <p className="stay-sub muted small">
          <Users aria-hidden="true" className="icon-inline" /> Up to {stay.capacity} · {stay.bedrooms} bedroom{stay.bedrooms === 1 ? '' : 's'} · {stay.distanceKm} km to centre · Host {stay.host}
        </p>
        <Rating value={stay.rating} reviews={stay.reviews} />
        <ul className="stay-amenities list-plain" aria-label="Amenities">
          {stay.amenities.slice(0, 6).map((a) => (
            <li key={a}>
              <Glyph emoji={AMENITIES[a]?.emoji} label={AMENITIES[a]?.label || a} />
            </li>
          ))}
        </ul>
        <div className="stay-foot">
          <div className="stay-price-wrap">
            <span className="stay-price">{fmt.money(stay.pricePerNight)}</span>
            <span className="muted small"> / night</span>
            <p className="small">
              <strong>{fmt.money(total)}</strong> <span className="muted">for {nights} night{nights === 1 ? '' : 's'}{stay.cleaningFee ? ' incl. cleaning' : ''}</span>
            </p>
            {stay.freeCancellation && <p className="stay-cancel small">Free cancellation</p>}
          </div>
          {onSelect &&
            (selected ? (
              <span className="pass-selected">
                <Check aria-hidden="true" /> Your stay
              </span>
            ) : tooSmall ? (
              <span className="badge badge-warning">Sleeps {stay.capacity}</span>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onSelect}>
                Stay here
              </button>
            ))}
        </div>
      </div>
    </article>
  )
}
