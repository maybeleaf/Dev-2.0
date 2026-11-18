import { Check, Leaf, Luggage, Plane } from 'lucide-react'
import { flightInconvenience } from '../engine/flights.js'
import { epochToZoned, formatDate } from '../lib/time.js'

const TAG_LABEL = { best: 'Best overall', cheapest: 'Cheapest', fastest: 'Fastest' }

/** A flight option drawn as a boarding pass. */
export function BoardingPass({ flight: f, fmt, travelers = 1, selected, onSelect, priceDelta, compact = false, headingLevel = 3 }) {
  const dep = epochToZoned(f.depart, f.from.timezone)
  const arr = epochToZoned(f.arrive, f.to.timezone)
  const dayShift = Math.round((Date.parse(`${arr.date}T00:00:00Z`) - Date.parse(`${dep.date}T00:00:00Z`)) / 86400000)
  const H = `h${headingLevel}`
  const odd = flightInconvenience(f) >= 0.7
  return (
    <article className={`pass ${selected ? 'is-selected' : ''} ${compact ? 'is-compact' : ''}`} style={{ '--airline': f.airline.color }} aria-label={`${f.airline.name} ${f.flightNo}${selected ? ', selected' : ''}`}>
      <div className="pass-main">
        <header className="pass-head">
          <span className="pass-airline">
            <span className="pass-logo" aria-hidden="true">
              {f.airline.code}
            </span>
            <H className="pass-airline-name">
              {f.airline.name} <span className="mono muted">{f.flightNo}</span>
            </H>
          </span>
          <span className="pass-tags">
            {f.tags.map((t) => (
              <span key={t} className={`badge ${t === 'best' ? 'badge-accent' : t === 'cheapest' ? 'badge-success' : 'badge-sky'}`}>
                {TAG_LABEL[t]}
              </span>
            ))}
            {odd && <span className="badge badge-warning">Unsociable hours</span>}
          </span>
        </header>
        <div className="pass-route">
          <div className="pass-end">
            <span className="pass-code mono">{f.from.code}</span>
            <span className="pass-time mono">{fmt.time(f.depart, f.from.timezone)}</span>
            <span className="pass-city">
              {f.from.city} · {formatDate(dep.date, 'short')}
            </span>
          </div>
          <div className="pass-line" aria-hidden="true">
            <span className="pass-dur">{fmt.durationShort(f.durationMin)}</span>
            <span className="pass-track">
              {f.stops > 0 && <span className="pass-stop-dot" />}
              <Plane className="pass-plane" />
            </span>
            <span className="pass-stops">{f.stops ? `1 stop · ${f.via.code}` : 'Nonstop'}</span>
          </div>
          <div className="pass-end pass-end-right">
            <span className="pass-code mono">{f.to.code}</span>
            <span className="pass-time mono">
              {fmt.time(f.arrive, f.to.timezone)}
              {dayShift > 0 && <sup className="pass-plus">+{dayShift}</sup>}
            </span>
            <span className="pass-city">
              {f.to.city} · {formatDate(arr.date, 'short')}
            </span>
          </div>
        </div>
        <p className="sr-only">
          Departs {f.from.city} {formatDate(dep.date, 'long')} at {fmt.time(f.depart, f.from.timezone)}, arrives {f.to.city} {formatDate(arr.date, 'long')} at {fmt.time(f.arrive, f.to.timezone)} local time. {fmt.duration(f.durationMin)},{' '}
          {f.stops ? `one stop in ${f.via.city} with a ${fmt.duration(f.via.layoverMin)} layover` : 'nonstop'}.
        </p>
        {!compact && (
          <ul className="pass-facts list-plain">
            {f.stops > 0 && (
              <li>
                Layover {fmt.duration(f.via.layoverMin)} in {f.via.city}
              </li>
            )}
            <li>{f.aircraft}</li>
            <li>
              <Luggage aria-hidden="true" /> {f.bags}
            </li>
            <li>
              <Leaf aria-hidden="true" /> ~{f.co2Kg} kg CO₂ pp
            </li>
            {f.seatsLeft && <li className="pass-seats">Only {f.seatsLeft} seats left at this price</li>}
          </ul>
        )}
      </div>
      <div className="pass-stub">
        <span className="pass-price">{fmt.money(f.price)}</span>
        <span className="pass-price-sub">
          per person{travelers > 1 ? ` · ${fmt.money(f.price * travelers)} total` : ''}
        </span>
        {priceDelta != null && !selected && priceDelta !== 0 && (
          <span className={`pass-delta ${priceDelta < 0 ? 'is-cheaper' : ''}`}>
            {priceDelta < 0 ? '−' : '+'}
            {fmt.money(Math.abs(priceDelta))} vs. yours
          </span>
        )}
        {onSelect &&
          (selected ? (
            <span className="pass-selected">
              <Check aria-hidden="true" /> Your flight
            </span>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onSelect}>
              Choose this flight
            </button>
          ))}
      </div>
    </article>
  )
}
