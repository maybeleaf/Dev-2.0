import { useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, Clock3, Coins, Droplets, Languages, Plane, Plug, Search, Siren, TrainFront, Wallet } from 'lucide-react'
import { Poster } from '../components/Poster.jsx'
import { SpeakButton } from '../components/SpeakButton.jsx'
import { Glyph, PriceLevel, Rating } from '../components/ui.jsx'
import { useNow } from '../context/ClockContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { CATEGORIES, MEALS, TAGS, VIBES } from '../data/categories.js'
import { AIRPORT_BY_CODE, DESTINATION_BY_ID } from '../data/index.js'
import { estimateTripCost } from '../engine/planTrip.js'
import { flightHours } from '../engine/recommend.js'
import { useFormat } from '../hooks/useFormat.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { fromUSD } from '../lib/money.js'
import { href } from '../lib/router.js'
import { monthOf, todayStr, tzOffsetMinutes } from '../lib/time.js'
import '../styles/explore.css'

const MONTH_SHORT = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, i, 15)))
const MONTH_LONG = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2026, i, 15)))
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHOW_TAGS = ['iconic', 'free', 'rainy-day', 'hidden-gem', 'local-favorite', 'views', 'step-free', 'booking-advised', 'vegetarian']
const PAGE = 12

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function listMonths(months) {
  const names = [...months].sort((a, b) => a - b).map((m) => MONTH_LONG[m - 1])
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || ''
}

function ClimateChart({ dest, thisMonth }) {
  const highs = dest.climate.map((c) => c.high)
  const lo = Math.min(...highs) - 6
  const hi = Math.max(...highs)
  return (
    <>
      <ol className="climate list-plain" aria-label={`Average daily high by month. Best months: ${listMonths(dest.bestMonths)}.`}>
        {dest.climate.map((c, i) => {
          const best = dest.bestMonths.includes(i + 1)
          return (
            <li key={i} className={`${best ? 'is-best' : ''} ${i + 1 === thisMonth ? 'is-now' : ''}`}>
              <span className="climate-temp num" aria-hidden="true">
                {c.high}°
              </span>
              <span className="climate-track" aria-hidden="true">
                <span className="climate-bar" style={{ '--h': (c.high - lo) / (hi - lo) }} />
              </span>
              <span className="climate-month" aria-hidden="true">
                {MONTH_SHORT[i]}
              </span>
              <span className="sr-only">
                {MONTH_LONG[i]}: high {c.high}°C, low {c.low}°C, about {c.rain} rainy days{best ? ', a best month to go' : ''}.
              </span>
            </li>
          )
        })}
      </ol>
      <p className="climate-key" aria-hidden="true">
        <span>
          <span className="climate-swatch" /> Best months to go
        </span>
        <span>
          <span className="climate-swatch is-off" /> Other months
        </span>
        <span>Average daily high, °C</span>
      </p>
    </>
  )
}

function Activity({ a, fmt }) {
  const cat = CATEGORIES[a.category]
  const meal = a.category === 'food' ? MEALS[a.meal] : null
  const tags = (a.tags || []).filter((t) => SHOW_TAGS.includes(t) && !(t === 'free' && a.cost === 0)).slice(0, 3)
  const [open, close] = a.hours || [0, 24]
  return (
    <li>
      <article className="todo" style={{ '--c': `var(--cat-${a.category})` }}>
        <p className="todo-kicker">
          <Glyph emoji={meal ? meal.emoji : cat?.emoji} label={meal ? meal.label : cat?.label} /> · {a.type}
        </p>
        <h3 className="todo-name">{a.name}</h3>
        <p className="todo-desc">{a.description}</p>
        {tags.length > 0 && (
          <ul className="todo-tags list-plain" aria-label="Good to know">
            {tags.map((t) => (
              <li key={t} className={`badge ${t === 'booking-advised' ? 'badge-warning' : ''}`}>
                {TAGS[t]}
              </li>
            ))}
          </ul>
        )}
        <p className="todo-meta">
          <Rating value={a.rating} />
          <span>
            <Clock3 aria-hidden="true" /> {fmt.duration(a.duration)}
          </span>
          <span>{a.cost ? `${fmt.money(a.cost)} pp` : 'Free'}</span>
          {a.priceLevel && a.category === 'food' && <PriceLevel level={a.priceLevel} />}
          <span>
            {open === 0 && close >= 24 ? 'Open 24 hours' : `${fmt.hours(open)}–${fmt.hours(close)}`}
            {a.closedDays?.length ? ` · closed ${a.closedDays.map((d) => DOW[d]).join(', ')}` : ''}
          </span>
          {a.area && <span>{a.area}</span>}
        </p>
      </article>
    </li>
  )
}

function ThingsToDo({ dest, fmt }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState('rating')
  const [extras, setExtras] = useState([])
  const [all, setAll] = useState(false)
  const cats = Object.keys(CATEGORIES).filter((c) => dest.activities.some((a) => a.category === c))

  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    const out = dest.activities.filter(
      (a) =>
        (!cat || a.category === cat) &&
        (!extras.includes('free') || a.cost === 0) &&
        (!extras.includes('rainy-day') || (a.tags || []).some((t) => t === 'rainy-day' || t === 'indoor')) &&
        (!extras.includes('step-free') || (a.tags || []).includes('step-free')) &&
        words.every((w) => norm(`${a.name} ${a.type} ${a.area} ${a.description} ${a.cuisine || ''}`).includes(w)),
    )
    const by = { rating: (x, y) => y.rating - x.rating, price: (x, y) => x.cost - y.cost || y.rating - x.rating, duration: (x, y) => x.duration - y.duration, name: (x, y) => x.name.localeCompare(y.name) }[sort]
    return out.sort(by)
  }, [dest, q, cat, sort, extras])

  const shown = all ? list : list.slice(0, PAGE)
  const toggleExtra = (k) => setExtras((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))

  return (
    <section aria-labelledby="todo-title">
      <h2 id="todo-title" className="dp-section-title">
        Things to do &amp; eat
      </h2>
      <div className="todo-tools">
        <div className="input-group">
          <Search aria-hidden="true" />
          <label htmlFor="todo-q" className="sr-only">
            Search places in {dest.name}
          </label>
          <input id="todo-q" className="input" type="search" placeholder={`Search ${dest.activities.length} places…`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="chip-scroll" role="group" aria-label="Category">
          <button type="button" className="chip" aria-pressed={!cat} onClick={() => setCat('')}>
            All
          </button>
          {cats.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>
              <Glyph emoji={CATEGORIES[c].emoji} label={CATEGORIES[c].label} />
            </button>
          ))}
        </div>
        <div className="todo-tools-row">
          <div className="chip-row" role="group" aria-label="Only show">
            {[
              ['free', '🆓', 'Free'],
              ['rainy-day', '☔', 'Rainy-day'],
              ['step-free', '♿', 'Step-free'],
            ].map(([k, e, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={extras.includes(k)} onClick={() => toggleExtra(k)}>
                <Glyph emoji={e} label={l} />
              </button>
            ))}
          </div>
          <div className="field explore-sort">
            <label className="label" htmlFor="todo-sort">
              Sort
            </label>
            <select id="todo-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="rating">Top rated</option>
              <option value="price">Cheapest</option>
              <option value="duration">Quickest</option>
              <option value="name">A–Z</option>
            </select>
          </div>
        </div>
        <p className="muted small" aria-live="polite">
          {list.length} place{list.length === 1 ? '' : 's'}
        </p>
      </div>
      {list.length ? (
        <>
          <ul className="todo-grid list-plain">
            {shown.map((a) => (
              <Activity key={a.id} a={a} fmt={fmt} />
            ))}
          </ul>
          {list.length > PAGE && (
            <div className="todo-more">
              <button type="button" className="btn btn-secondary" onClick={() => setAll((v) => !v)}>
                {all ? 'Show fewer' : `Show all ${list.length}`}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🔎
          </span>
          <h3>Nothing matches</h3>
          <p>Try another word or clear the filters.</p>
        </div>
      )}
    </section>
  )
}

export function DestinationPage({ id }) {
  const dest = DESTINATION_BY_ID[id]
  usePageTitle(dest ? `${dest.name}, ${dest.country}` : 'Destination not found')
  const fmt = useFormat()
  const { settings } = useSettings()
  const now = useNow(30000)

  if (!dest) {
    return (
      <div className="container page">
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🗺️
          </span>
          <h1>We don’t know that place (yet)</h1>
          <p>Have a look at the destinations we do cover.</p>
          <a className="btn btn-primary" href="#/explore">
            Explore destinations
          </a>
        </div>
      </div>
    )
  }

  const home = AIRPORT_BY_CODE[settings.homeAirport] || null
  const thisMonth = monthOf(todayStr())
  const hrs = flightHours(home, dest)
  const estimate = home && home.code !== dest.airport.code ? estimateTripCost(dest, home, { days: 6, travelers: 2 }) : null
  const diff = home ? (tzOffsetMinutes(now, dest.timezone) - tzOffsetMinutes(now, home.timezone)) / 60 : 0
  const diffText = !home || diff === 0 ? (home ? `Same time as ${home.city}` : '') : `${Math.abs(diff)} h ${diff > 0 ? 'ahead of' : 'behind'} ${home.city}`
  const perUserUnit = dest.currency.perUSD / fromUSD(1, fmt.currency)
  const speech = () =>
    `${dest.name}, ${dest.country}. ${dest.tagline}. ${dest.description} The best months to go are ${listMonths(dest.bestMonths)}. ` +
    `It's ${fmt.time(now, dest.timezone)} there now. ${estimate ? `Six days for two from ${home.city} costs about ${fmt.money(estimate)}.` : ''}`

  return (
    <div className="container page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="#/explore">
          <ChevronLeft aria-hidden="true" /> Explore
        </a>
      </nav>

      <header className="dp-hero">
        <Poster dest={dest} ratio="banner" className="dp-hero-poster" />
        <div className="dp-hero-body">
          <div>
            <p className="dp-country">
              {dest.country} · {dest.region}
            </p>
            <h1 className="dp-name">{dest.name}</h1>
            <p className="dp-tagline">{dest.tagline}</p>
          </div>
          <div className="dp-hero-cta">
            <a className="btn btn-primary btn-lg" href={href('/', { to: dest.id, from: settings.homeAirport })}>
              Plan a trip here <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <div className="dp-layout">
        <div className="dp-main stack" style={{ '--stack-gap': '2.25rem' }}>
          <section aria-labelledby="about-title">
            <div className="spread">
              <h2 id="about-title" className="dp-section-title">
                Why go
              </h2>
              <SpeakButton text={speech} label={`Read about ${dest.name}`} />
            </div>
            <p className="dp-intro">{dest.description}</p>
            <ul className="chip-row list-plain dp-vibes" aria-label="Vibes">
              {dest.vibes.map((v) => (
                <li key={v} className="chip chip-static">
                  <Glyph emoji={VIBES[v]?.emoji} label={VIBES[v]?.label || v} />
                </li>
              ))}
            </ul>
          </section>

          <section className="card card-pad" aria-labelledby="climate-title">
            <div className="spread">
              <h2 id="climate-title" className="card-title">
                When to go
              </h2>
              <span className={`badge climate-best ${dest.bestMonths.includes(thisMonth) ? 'badge-success' : ''}`}>{dest.bestMonths.includes(thisMonth) ? 'Great right now' : `Best: ${listMonths(dest.bestMonths)}`}</span>
            </div>
            <ClimateChart dest={dest} thisMonth={thisMonth} />
          </section>

          <section aria-labelledby="hoods-title">
            <h2 id="hoods-title" className="dp-section-title">
              Neighbourhoods
            </h2>
            <ul className="hoods list-plain">
              {dest.neighborhoods.map((n) => (
                <li key={n.name} className="hood">
                  <p className="hood-name">{n.name}</p>
                  <p>{n.blurb}</p>
                </li>
              ))}
            </ul>
          </section>

          <ThingsToDo dest={dest} fmt={fmt} />
        </div>

        <aside className="dp-side stack" style={{ '--stack-gap': '1.25rem' }} aria-label={`${dest.name} at a glance`}>
          <section className="card card-pad" aria-labelledby="dp-time-title">
            <h2 id="dp-time-title" className="card-title">
              Local time
            </h2>
            <p className="dp-time">
              <span className="dp-time-now">{fmt.time(now, dest.timezone)}</span>
              <span className="muted small">
                {fmt.epochDate(now, dest.timezone, 'long')}
                {diffText ? ` · ${diffText}` : ''}
              </span>
            </p>
          </section>

          {estimate != null && (
            <section className="card card-pad" aria-labelledby="dp-cost-title">
              <h2 id="dp-cost-title" className="card-title">
                What it costs
              </h2>
              <div className="dp-cost">
                <p className="dp-cost-total num">{fmt.money(estimate)}</p>
                <p className="muted small">
                  6 days for 2 from {home.city} · flights, stay, food and fun · about {fmt.money(estimate / 2)} each
                </p>
              </div>
              <a className="btn btn-dark btn-block" style={{ marginTop: '1rem' }} href={href('/', { to: dest.id, from: settings.homeAirport })}>
                Plan it <ArrowRight aria-hidden="true" />
              </a>
            </section>
          )}

          <section className="card card-pad" aria-labelledby="dp-facts-title">
            <h2 id="dp-facts-title" className="card-title">
              Good to know
            </h2>
            <dl className="facts">
              {hrs != null && home.code !== dest.airport.code && (
                <div>
                  <dt>
                    <Plane aria-hidden="true" /> Flight
                  </dt>
                  <dd>
                    About {Math.max(1, Math.round(hrs))} h from {home.city} into {dest.airport.code}
                  </dd>
                </div>
              )}
              <div>
                <dt>
                  <TrainFront aria-hidden="true" /> Getting in
                </dt>
                <dd>
                  {dest.airportTransfer.mode} · {dest.airportTransfer.minutes} min · {dest.airportTransfer.cost ? fmt.money(dest.airportTransfer.cost) : 'free'}
                </dd>
              </div>
              <div>
                <dt>
                  <Wallet aria-hidden="true" /> Getting around
                </dt>
                <dd>{dest.transit}</dd>
              </div>
              <div>
                <dt>
                  <Coins aria-hidden="true" /> Money
                </dt>
                <dd>
                  {dest.currency.code} ({dest.currency.symbol}) · 1 {fmt.currency} ≈ {perUserUnit >= 100 ? Math.round(perUserUnit) : perUserUnit.toFixed(2)} {dest.currency.code}
                  <br />
                  <span className="muted small">{dest.practical.tipping}</span>
                </dd>
              </div>
              <div>
                <dt>
                  <Languages aria-hidden="true" /> Language
                </dt>
                <dd>{dest.languages.join(', ')}</dd>
              </div>
              <div>
                <dt>
                  <Plug aria-hidden="true" /> Power
                </dt>
                <dd>{dest.practical.plug}</dd>
              </div>
              <div>
                <dt>
                  <Droplets aria-hidden="true" /> Water
                </dt>
                <dd>{dest.practical.water}</dd>
              </div>
              <div>
                <dt>
                  <Siren aria-hidden="true" /> Emergency
                </dt>
                <dd>{dest.practical.emergency}</dd>
              </div>
            </dl>
          </section>
          <p className="muted small">Places are real; prices, hours and ratings are approximate mock data for planning.</p>
        </aside>
      </div>
    </div>
  )
}
