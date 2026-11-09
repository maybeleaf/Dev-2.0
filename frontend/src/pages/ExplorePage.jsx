import { useEffect, useMemo, useState } from 'react'
import { PlaneTakeoff, Search, SlidersHorizontal, X } from 'lucide-react'
import { Combobox } from '../components/Combobox.jsx'
import { DestinationCard } from '../components/DestinationCard.jsx'
import { ChipGroup } from '../components/ui.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { REGIONS, VIBES, VIBE_KEYS } from '../data/categories.js'
import { AIRPORT_BY_CODE, DESTINATIONS } from '../data/index.js'
import { rankDestinations } from '../engine/recommend.js'
import { useFormat } from '../hooks/useFormat.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { airportOptions } from '../lib/options.js'
import { href } from '../lib/router.js'
import { monthOf, todayStr } from '../lib/time.js'
import '../styles/explore.css'

const monthName = (m) => new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2026, m - 1, 15))
const BUDGETS = [0, 800, 1200, 1800, 2500, 4000] // USD per person, 0 = any
const HOURS = [0, 4, 8, 12, 16] // max flight hours, 0 = any
const LENGTHS = [3, 4, 6, 8, 10, 14]
const SORTS = { match: 'Best match', price: 'Lowest price', flight: 'Shortest flight', name: 'A–Z' }
const REGIONS_PRESENT = REGIONS.filter((r) => DESTINATIONS.some((d) => d.region === r))
const VIBES_PRESENT = VIBE_KEYS.filter((v) => DESTINATIONS.some((d) => d.vibes.includes(v)))

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Search covers names, countries, vibes, neighbourhoods and every place in the data ("ramen", "fado", "lucha").
const SEARCH_INDEX = Object.fromEntries(
  DESTINATIONS.map((d) => [
    d.id,
    norm(
      [d.name, d.country, d.region, d.tagline, d.description, ...d.vibes.map((v) => VIBES[v]?.label || v), ...d.neighborhoods.map((n) => n.name), ...d.activities.map((a) => `${a.name} ${a.type || ''} ${a.cuisine || ''} ${a.area || ''}`)].join(' '),
    ),
  ]),
)

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

export function ExplorePage({ query }) {
  usePageTitle('Explore destinations')
  const { settings, update } = useSettings()
  const fmt = useFormat()
  const thisMonth = monthOf(todayStr())

  const [q, setQ] = useState(query.q || '')
  const [region, setRegion] = useState(pick(query.region, REGIONS_PRESENT, ''))
  const [vibes, setVibes] = useState(() => (query.vibes || '').split(',').filter((v) => VIBES[v]))
  const [month, setMonth] = useState(() => pick(Number(query.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 0))
  const [budget, setBudget] = useState(() => pick(Number(query.budget), BUDGETS, 0))
  const [hours, setHours] = useState(() => pick(Number(query.hours), HOURS, 0))
  const [days, setDays] = useState(() => pick(Number(query.days), LENGTHS, 6))
  const [sort, setSort] = useState(SORTS[query.sort] ? query.sort : 'match')
  const [showFilters, setShowFilters] = useState(false)
  const travelers = 2

  // Keep the URL shareable without re-rendering the whole app on every keystroke.
  useEffect(() => {
    const target = href('/explore', { q: q.trim(), region, vibes: vibes.join(','), month: month || '', budget: budget || '', hours: hours || '', days: days !== 6 ? days : '', sort: sort !== 'match' ? sort : '' })
    if (window.location.hash !== target) window.history.replaceState(null, '', target)
  }, [q, region, vibes, month, budget, hours, days, sort])

  const origin = AIRPORT_BY_CODE[settings.homeAirport] || null
  const ranked = useMemo(
    () => rankDestinations(DESTINATIONS, { vibes, budgetUSD: budget ? budget * travelers : undefined, days, travelers, origin, month: month || undefined, maxFlightHours: hours || undefined }),
    [vibes, budget, days, origin, month, hours],
  )

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    const list = ranked.filter(
      (r) =>
        (!origin || r.dest.airport.code !== origin.code) &&
        (!region || r.dest.region === region) &&
        (!vibes.length || vibes.some((v) => r.dest.vibes.includes(v))) &&
        (!budget || r.estimate / travelers <= budget) &&
        (!hours || r.flightHours == null || r.flightHours <= hours) &&
        words.every((w) => SEARCH_INDEX[r.dest.id].includes(w)),
    )
    if (sort === 'price') return [...list].sort((a, b) => a.estimate - b.estimate)
    if (sort === 'flight') return [...list].sort((a, b) => (a.flightHours ?? 99) - (b.flightHours ?? 99))
    if (sort === 'name') return [...list].sort((a, b) => a.dest.name.localeCompare(b.dest.name))
    return list
  }, [ranked, q, region, vibes, budget, hours, sort, origin])

  const active = (region ? 1 : 0) + vibes.length + (month ? 1 : 0) + (budget ? 1 : 0) + (hours ? 1 : 0)
  const clear = () => {
    setQ('')
    setRegion('')
    setVibes([])
    setMonth(0)
    setBudget(0)
    setHours(0)
  }

  return (
    <div className="container page explore">
      <header className="page-head">
        <div>
          <p className="eyebrow">Explore</p>
          <h1>Where to next?</h1>
          <p className="lede">
            {DESTINATIONS.length} cities, each with real places to go and eat. Prices are estimates for {travelers} people, {days} days, flying from {origin ? origin.city : 'your home airport'}.
          </p>
        </div>
      </header>

      <div className="explore-bar">
        <div className="input-group explore-search">
          <Search aria-hidden="true" />
          <label htmlFor="explore-q" className="sr-only">
            Search destinations
          </label>
          <input id="explore-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cities, vibes or places — “ramen”, “beach”, “fado”…" autoComplete="off" />
          {q && (
            <button type="button" className="btn btn-ghost btn-icon btn-sm explore-clear" onClick={() => setQ('')} aria-label="Clear search">
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="explore-origin">
          <Combobox id="explore-origin" label="Flying from" icon={PlaneTakeoff} options={airportOptions()} value={settings.homeAirport} onChange={(v) => v && update({ homeAirport: v })} placeholder="City or airport code" />
        </div>
        <button type="button" className="btn filters-toggle" aria-expanded={showFilters} aria-controls="explore-filters" onClick={() => setShowFilters((s) => !s)}>
          <SlidersHorizontal aria-hidden="true" /> Filters
          {active > 0 && <span className="badge badge-accent">{active}</span>}
        </button>
      </div>

      <section id="explore-filters" className={`explore-filters card card-pad ${showFilters ? 'is-open' : ''}`} aria-label="Filters">
        <fieldset className="fieldset">
          <legend className="label">Region</legend>
          <div className="chip-row">
            {['', ...REGIONS_PRESENT].map((r) => (
              <button key={r || 'all'} type="button" className="chip" aria-pressed={region === r} onClick={() => setRegion(r)}>
                {r || 'Anywhere'}
              </button>
            ))}
          </div>
        </fieldset>
        <ChipGroup legend="Vibe" name="explore-vibes" values={vibes} onChange={setVibes} options={VIBES_PRESENT.map((v) => ({ value: v, label: VIBES[v].label, emoji: VIBES[v].emoji }))} />
        <div className="explore-selects">
          <div className="field">
            <label className="label" htmlFor="explore-month">
              When
            </label>
            <select id="explore-month" className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              <option value={0}>Any time</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {monthName(i + 1)}
                  {i + 1 === thisMonth ? ' (this month)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="explore-budget">
              Budget per person
            </label>
            <select id="explore-budget" className="select" value={budget} onChange={(e) => setBudget(Number(e.target.value))}>
              {BUDGETS.map((b) => (
                <option key={b} value={b}>
                  {b ? `Up to ${fmt.money(b)}` : 'Any budget'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="explore-hours">
              Flight time
            </label>
            <select id="explore-hours" className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h ? `Up to ${h} hours` : 'Any length'}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="explore-days">
              Trip length
            </label>
            <select id="explore-days" className="select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {LENGTHS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
        </div>
        {active > 0 && (
          <button type="button" className="link-btn explore-reset" onClick={clear}>
            Clear all filters
          </button>
        )}
      </section>

      <div className="explore-results-head">
        <p className="explore-count" aria-live="polite">
          <strong>{results.length}</strong> destination{results.length === 1 ? '' : 's'}
          {month ? ` · ranked for ${monthName(month)}` : ''}
        </p>
        <div className="field explore-sort">
          <label className="label" htmlFor="explore-sort">
            Sort
          </label>
          <select id="explore-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results.length ? (
        <ul className="dest-grid list-plain">
          {results.map((r) => (
            <li key={r.dest.id}>
              <DestinationCard dest={r.dest} estimate={r.estimate} flightHours={r.flightHours} travelers={travelers} inSeason={r.dest.bestMonths.includes(month || thisMonth)} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🧭
          </span>
          <h2>Nowhere matches all of that</h2>
          <p>Try fewer filters, a bigger budget or a longer flight.</p>
          <button type="button" className="btn btn-primary" onClick={clear}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
