import { Clock3, Leaf } from 'lucide-react'
import { VIBES } from '../data/categories.js'
import { useFormat } from '../hooks/useFormat.js'
import { Poster } from './Poster.jsx'
import { Glyph } from './ui.jsx'

/** Poster card for Explore / Home. `rank` is a rankDestinations() row. */
export function DestinationCard({ dest, estimate, flightHours, travelers = 2, inSeason, headingLevel = 3, compact = false }) {
  const fmt = useFormat()
  const H = `h${headingLevel}`
  return (
    <article className={`dest-card card ${compact ? 'is-compact' : ''}`}>
      <Poster dest={dest} ratio="poster" className="dest-card-poster">
        <div className="poster-title">
          <H className="poster-name">
            <a className="stretched-link" href={`#/destination/${dest.id}`}>
              {dest.name}
            </a>
          </H>
          <p className="poster-country">{dest.country}</p>
        </div>
        {inSeason && (
          <span className="dest-season badge">
            <Leaf aria-hidden="true" /> In season
          </span>
        )}
      </Poster>
      <div className="dest-card-body">
        <p className="dest-card-tagline">{dest.tagline}</p>
        {!compact && (
          <ul className="chip-row list-plain" aria-label="Vibes">
            {dest.vibes.slice(0, 3).map((v) => (
              <li key={v} className="chip chip-static">
                <Glyph emoji={VIBES[v]?.emoji} label={VIBES[v]?.label || v} />
              </li>
            ))}
          </ul>
        )}
        <dl className="dest-card-facts">
          {estimate != null && (
            <div>
              <dt>Trip from</dt>
              <dd>
                {fmt.money(estimate / travelers, { compact: true })} <span className="muted">pp</span>
              </dd>
            </div>
          )}
          {flightHours != null && (
            <div>
              <dt>Flight</dt>
              <dd>
                <Clock3 aria-hidden="true" className="icon-inline" /> ~{Math.max(1, Math.round(flightHours))} h
              </dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}
