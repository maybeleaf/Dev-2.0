import { useMemo, useState } from 'react'
import { Sparkles, SlidersHorizontal } from 'lucide-react'
import { StayCard } from '../../components/StayCard.jsx'
import { ChipGroup, Segmented } from '../../components/ui.jsx'
import { AMENITIES } from '../../data/categories.js'
import { selectStay } from '../../engine/edit.js'
import { stayKind, stayTotal } from '../../engine/stays.js'
import { useFormat } from '../../hooks/useFormat.js'
import { useStayRanking } from '../../hooks/useStayRanking.js'
import { fromUSD, toUSD } from '../../lib/money.js'

const RANK_MODES = [
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'nicest', label: 'Nicest' },
]

const FILTER_AMENITIES = ['kitchen', 'washer', 'ac', 'pool', 'breakfast', 'workspace', 'step-free', 'parking']

export function StayTab({ view }) {
  const { trip, dest, ctx, apply, budget } = view
  const fmt = useFormat()
  const nights = Math.max(1, trip.days.length - 1)
  const travelers = trip.params.travelers
  const prices = trip.stays.map((s) => s.pricePerNight)
  const maxPrice = Math.ceil(fromUSD(Math.max(...prices), fmt.currency))
  const minPrice = Math.floor(fromUSD(Math.min(...prices), fmt.currency))
  const [kind, setKind] = useState('all')
  const [hood, setHood] = useState('all')
  const [cap, setCap] = useState(maxPrice)
  const [minRating, setMinRating] = useState('0')
  const [amen, setAmen] = useState(trip.params.mobility === 'low-walking' ? ['step-free'] : [])
  const [sort, setSort] = useState('match')
  const [rankMode, setRankMode] = useState('balanced')

  // What's left for the stay once flights and the days out are paid for.
  const stayBudget = budget ? budget.budget - (budget.total - budget.amounts.stay) : trip.params.budgetUSD

  const filtered = useMemo(() => {
    const capUSD = toUSD(cap, fmt.currency) + 0.5
    const value = (s) => s.rating * 2 - s.distanceKm * 0.12 + (s.superhost ? 0.15 : 0) - stayTotal(s, nights) / Math.max(1, trip.params.budgetUSD) * 3
    const sorters = {
      value: (a, b) => value(b) - value(a),
      price: (a, b) => a.pricePerNight - b.pricePerNight,
      rating: (a, b) => b.rating - a.rating,
      distance: (a, b) => a.distanceKm - b.distanceKm,
    }
    return trip.stays
      .filter((s) => kind === 'all' || stayKind(s) === kind)
      .filter((s) => hood === 'all' || s.neighborhood === hood)
      .filter((s) => s.pricePerNight <= capUSD)
      .filter((s) => s.rating >= Number(minRating))
      .filter((s) => amen.every((a) => s.amenities.includes(a)))
      .sort(sorters[sort] || sorters.value)
  }, [trip.stays, kind, hood, cap, minRating, amen, sort, fmt.currency, nights, trip.params.budgetUSD])

  // "Best match" asks the backend ranker; any other sort stays local.
  const ranking = useStayRanking({ stays: filtered, budget: stayBudget, nights, mode: rankMode, enabled: sort === 'match' })
  const ranked = sort === 'match' && ranking.status === 'ok'
  const results = ranked ? filtered.filter((s) => ranking.scores.has(s.id)).sort((a, b) => ranking.scores.get(b.id) - ranking.scores.get(a.id)) : filtered
  const overBudget = ranked ? filtered.filter((s) => !ranking.scores.has(s.id)) : []
  const topPick = ranked ? results[0] : null
  const shown = results.length + overBudget.length

  const pickStay = (s) => apply((t) => selectStay(t, s.id), { title: `Booked in (pretend): ${s.title}`, body: `${s.neighborhood} · days re-planned from your new base`, emoji: '🛏️' })

  const selectedHidden = !filtered.some((s) => s.id === ctx.stay.id)
  const card = (s) => (
    <li key={s.id}>
      <StayCard stay={s} dest={dest} fmt={fmt} nights={nights} travelers={travelers} selected={s.id === ctx.stay.id} match={ranked ? ranking.scores.get(s.id) : undefined} onSelect={() => pickStay(s)} />
    </li>
  )

  return (
    <div className="stays">
      <div className="stays-layout">
        <aside className="stays-filters card card-pad" aria-labelledby="stay-filter-title">
          <h2 id="stay-filter-title" className="filters-title">
            <SlidersHorizontal aria-hidden="true" /> Filters
          </h2>
          <Segmented
            name="stay-kind"
            legend="Type of place"
            value={kind}
            onChange={setKind}
            block
            options={[
              { value: 'all', label: 'Any' },
              { value: 'entire', label: 'Entire place' },
              { value: 'room', label: 'Room' },
              { value: 'hotel', label: 'Hotel-style' },
            ]}
          />
          <div className="field">
            <label className="label" htmlFor="stay-hood">
              Neighbourhood
            </label>
            <select id="stay-hood" className="select" value={hood} onChange={(e) => setHood(e.target.value)}>
              <option value="all">Anywhere</option>
              {dest.neighborhoods.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <div className="spread">
              <label className="label" htmlFor="stay-cap">
                Max per night
              </label>
              <span className="badge mono">{fmt.money(toUSD(cap, fmt.currency))}</span>
            </div>
            <input id="stay-cap" className="range" type="range" min={minPrice} max={maxPrice} step={Math.max(1, Math.round((maxPrice - minPrice) / 40))} value={cap} onChange={(e) => setCap(Number(e.target.value))} aria-valuetext={fmt.money(toUSD(cap, fmt.currency))} />
          </div>
          <Segmented
            name="stay-rating"
            legend="Guest rating"
            value={minRating}
            onChange={setMinRating}
            block
            options={[
              { value: '0', label: 'Any' },
              { value: '4.6', label: '4.6+' },
              { value: '4.8', label: '4.8+' },
            ]}
          />
          <ChipGroup legend="Must have" name="stay-amen" values={amen} onChange={setAmen} options={FILTER_AMENITIES.map((a) => ({ value: a, label: AMENITIES[a].label, emoji: AMENITIES[a].emoji }))} />
        </aside>

        <div className="stays-results">
          <div className="spread stays-bar">
            <p className="muted small" aria-live="polite">
              {shown} of {trip.stays.length} stays · {nights} nights · {travelers} guest{travelers === 1 ? '' : 's'}
            </p>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <label className="label" htmlFor="stay-sort">
                Sort
              </label>
              <select id="stay-sort" className="select" style={{ minHeight: 40, width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="match">Best match</option>
                <option value="value">Best value</option>
                <option value="price">Price: low to high</option>
                <option value="rating">Top rated</option>
                <option value="distance">Closest to centre</option>
              </select>
            </div>
          </div>
          {sort === 'match' && (
            <section className="stays-rank" aria-labelledby="stays-rank-title">
              <div className="stays-rank-head">
                <h3 id="stays-rank-title" className="sr-only">
                  Best match ranking
                </h3>
                <Segmented name="stay-rank-mode" legend="Rank for" value={rankMode} onChange={setRankMode} options={RANK_MODES} />
                {topPick && topPick.id !== ctx.stay.id && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => pickStay(topPick)}>
                    <Sparkles aria-hidden="true" /> Use top pick
                  </button>
                )}
              </div>
              <p className="stays-rank-status muted small" aria-live="polite">
                {ranking.status === 'loading' && 'Ranking stays…'}
                {ranked && `Ranked by price and rating against your ${fmt.money(Math.max(0, stayBudget))} stay budget.`}
                {ranking.status === 'offline' && 'The ranker isn’t reachable right now, so these are sorted by best value instead.'}
              </p>
              {ranked && ranking.warning && <p className="stays-rank-warning small">{ranking.warning}</p>}
            </section>
          )}
          {selectedHidden && (
            <div className="stays-current">
              <p className="eyebrow">Your current stay (hidden by filters)</p>
              <StayCard stay={ctx.stay} dest={dest} fmt={fmt} nights={nights} travelers={travelers} selected />
            </div>
          )}
          {shown === 0 || (results.length === 0 && !ranked) ? (
            <div className="empty">
              <span className="empty-emoji emoji" aria-hidden="true">
                🛏️
              </span>
              <h3>No stays match</h3>
              <p>Try a higher nightly price or fewer must-haves.</p>
            </div>
          ) : (
            <>
              {results.length > 0 && <ul className="stay-grid list-plain">{results.map(card)}</ul>}
              {overBudget.length > 0 && (
                <div className="stays-over">
                  <p className="eyebrow">Over your stay budget ({overBudget.length})</p>
                  <ul className="stay-grid list-plain">{overBudget.map(card)}</ul>
                </div>
              )}
            </>
          )}
          <p className="muted small stays-note">Listings are generated mock data in the shape of a real bnb API — swap in a provider later without touching this screen.</p>
        </div>
      </div>
    </div>
  )
}
