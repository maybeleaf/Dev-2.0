import { useMemo, useState } from 'react'
import { Copy, MoreHorizontal, Plus, Radio, Search, Share2, Trash2 } from 'lucide-react'
import { Menu } from '../components/Menu.jsx'
import { Poster } from '../components/Poster.jsx'
import { Emoji } from '../components/ui.jsx'
import { useNow } from '../context/ClockContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { PACES } from '../data/categories.js'
import { AIRPORT_BY_CODE, DESTINATION_BY_ID } from '../data/index.js'
import { useFormat } from '../hooks/useFormat.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { uid } from '../lib/random.js'
import { href } from '../lib/router.js'
import { shareUrl } from '../lib/share.js'
import { cloudEnabled } from '../lib/storage.js'
import { formatCountdown, formatDate } from '../lib/time.js'
import '../styles/trips.css'

/** An independent copy of a saved trip, with its own id and timestamps. */
function copyOf(trip) {
  const at = Date.now()
  return { ...structuredClone(trip), id: uid('trip'), title: `${trip.title} (copy)`, createdAt: at, updatedAt: at }
}

const DAY = 86400000
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'live', label: 'Live' },
  { key: 'past', label: 'Past' },
]

export function TripsPage() {
  usePageTitle('My trips')
  const { trips, addTrip, deleteTrip } = useTrips()
  const { push } = useToast()
  const fmt = useFormat()
  const now = useNow(60000)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('soonest')

  const rows = useMemo(
    () =>
      trips
        .map((t) => {
          const dest = DESTINATION_BY_ID[t.destinationId]
          const ob = t.flights?.outbound.find((f) => f.id === t.selected.outbound)
          const ib = t.flights?.inbound.find((f) => f.id === t.selected.inbound)
          if (!dest || !ob || !ib) return null
          const status = now < ob.depart - DAY ? 'upcoming' : now < ib.arrive ? 'live' : 'past'
          const stops = t.days.reduce((n, d) => n + d.items.length, 0)
          return { trip: t, dest, ob, ib, status, stops, origin: AIRPORT_BY_CODE[t.originCode] }
        })
        .filter(Boolean),
    [trips, now],
  )

  const counts = useMemo(() => rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1, all: c.all + 1 }), { all: 0 }), [rows])

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const list = rows.filter((r) => (filter === 'all' || r.status === filter) && words.every((w) => `${r.trip.title} ${r.dest.name} ${r.dest.country} ${r.origin?.city || ''}`.toLowerCase().includes(w)))
    const order = { live: 0, upcoming: 1, past: 2 }
    if (sort === 'recent') return list.sort((a, b) => (b.trip.updatedAt || 0) - (a.trip.updatedAt || 0))
    if (sort === 'name') return list.sort((a, b) => a.trip.title.localeCompare(b.trip.title))
    return list.sort((a, b) => order[a.status] - order[b.status] || (a.status === 'past' ? b.ob.depart - a.ob.depart : a.ob.depart - b.ob.depart))
  }, [rows, q, filter, sort])

  const duplicate = (t) => {
    addTrip(copyOf(t))
    push({ title: 'Trip duplicated', body: 'Edit the copy freely — the original stays as it is.', emoji: '📄', tone: 'success' })
  }

  const share = async (t) => {
    const url = shareUrl(t)
    try {
      await navigator.clipboard.writeText(url)
      push({ title: 'Share link copied', emoji: '🔗', tone: 'success' })
    } catch {
      push({ title: 'Copy this link', body: url, tone: 'info', duration: 12000 })
    }
  }

  const remove = (t) => {
    deleteTrip(t.id)
    push({ title: `Deleted “${t.title}”`, emoji: '🗑️', tone: 'info', action: { label: 'Undo', onClick: () => addTrip(t) }, duration: 8000 })
  }

  if (!rows.length) {
    return (
      <div className="container page">
        <header className="page-head">
          <div>
            <p className="eyebrow">My trips</p>
            <h1>Nothing booked in your head yet</h1>
          </div>
        </header>
        <div className="empty trips-empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🧳
          </span>
          <h2>Your trips will live here</h2>
          <p>Plan one in under a minute — flights, a bnb, every day mapped out and kept on budget.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn btn-primary" href="#/">
              <Plus aria-hidden="true" /> Plan a trip
            </a>
            <a className="btn btn-secondary" href="#/explore">
              Browse destinations
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container page">
      <header className="page-head">
        <div>
          <p className="eyebrow">My trips</p>
          <h1>
            {counts.all} trip{counts.all === 1 ? '' : 's'} planned
          </h1>
          <p className="lede">Saved in this browser{cloudEnabled ? ' and synced to the cloud' : ''}. Open one to tweak it, or go live on travel day.</p>
        </div>
        <a className="btn btn-primary" href="#/">
          <Plus aria-hidden="true" /> New trip
        </a>
      </header>

      <div className="trips-tools">
        <div className="input-group trips-search">
          <Search aria-hidden="true" />
          <label htmlFor="trips-q" className="sr-only">
            Search your trips
          </label>
          <input id="trips-q" className="input" type="search" placeholder="Search by name or place…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="chip-row" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} disabled={f.key !== 'all' && !counts[f.key]}>
              {f.key === 'live' && counts.live > 0 && <span className="live-dot" aria-hidden="true" />}
              {f.label} <span className="muted">{counts[f.key] || 0}</span>
            </button>
          ))}
        </div>
        <div className="field explore-sort">
          <label className="label" htmlFor="trips-sort">
            Sort
          </label>
          <select id="trips-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="soonest">Soonest first</option>
            <option value="recent">Recently edited</option>
            <option value="name">A–Z</option>
          </select>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {shown.length} trip{shown.length === 1 ? '' : 's'} shown
      </p>

      {shown.length ? (
        <ul className="trips-grid list-plain">
          {shown.map(({ trip, dest, ob, status, stops, origin }) => (
            <li key={trip.id}>
              <article className={`trip-card card is-${status}`}>
                <Poster dest={dest} ratio="wide" className="trip-card-poster" />
                <span className={`trip-card-status badge ${status === 'live' ? 'badge-success' : status === 'upcoming' ? 'badge-ink' : ''}`}>
                  {status === 'live' && <span className="live-dot" aria-hidden="true" />}
                  {status === 'live' ? 'Live now' : status === 'upcoming' ? `In ${formatCountdown(ob.depart - now).split(' ').slice(0, 2).join(' ')}` : 'Completed'}
                </span>
                <div className="trip-card-body">
                  <h2 className="trip-card-title">
                    <a className="stretched-link" href={href(`/trip/${trip.id}`)}>
                      {trip.title}
                    </a>
                  </h2>
                  <p className="muted small">
                    {formatDate(trip.days[0].date, 'medium')} – {formatDate(trip.days[trip.days.length - 1].date, 'medium')}
                  </p>
                  <ul className="trip-card-meta list-plain">
                    <li>
                      <Emoji>✈️</Emoji> {origin?.city || trip.originCode} → {dest.name}
                    </li>
                    <li>
                      <Emoji>👥</Emoji> {trip.params.travelers}
                    </li>
                    <li>
                      <Emoji>📍</Emoji> {stops} stops
                    </li>
                    <li>
                      <Emoji>{PACES[trip.params.pace]?.emoji}</Emoji> {PACES[trip.params.pace]?.label}
                    </li>
                    <li>
                      <Emoji>💰</Emoji> {fmt.money(trip.params.budgetUSD)}
                    </li>
                  </ul>
                </div>
                <div className="trip-card-actions">
                  <a className={`btn btn-sm ${status === 'live' ? 'btn-primary' : 'btn-secondary'}`} href={href(`/live/${trip.id}`)}>
                    <Radio aria-hidden="true" /> Live view
                  </a>
                  <Menu
                    label={`More actions for ${trip.title}`}
                    icon={MoreHorizontal}
                    items={[
                      { key: 'share', label: 'Copy share link', icon: Share2, onSelect: () => share(trip) },
                      { key: 'dup', label: 'Duplicate', icon: Copy, onSelect: () => duplicate(trip) },
                      { separator: true },
                      { key: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => remove(trip) },
                    ]}
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🔍
          </span>
          <h2>No trips match</h2>
          <p>Try a different word or filter.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setQ('')
              setFilter('all')
            }}
          >
            Show all trips
          </button>
        </div>
      )}
    </div>
  )
}
