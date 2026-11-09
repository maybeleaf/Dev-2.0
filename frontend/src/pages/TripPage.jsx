import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CalendarPlus,
  Check,
  ChevronLeft,
  LayoutDashboard,
  ListChecks,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plane,
  Printer,
  Radio,
  Route,
  Share2,
  Trash2,
  Wallet,
  Wand2,
  X,
} from 'lucide-react'
import { Dialog } from '../components/Dialog.jsx'
import { Menu } from '../components/Menu.jsx'
import { Poster } from '../components/Poster.jsx'
import { SpeakButton } from '../components/SpeakButton.jsx'
import { Emoji } from '../components/ui.jsx'
import { useNow } from '../context/ClockContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { PACES } from '../data/categories.js'
import { fitToBudget } from '../engine/budget.js'
import { smartSortAll } from '../engine/edit.js'
import { buildIcs } from '../engine/ics.js'
import { useFormat } from '../hooks/useFormat.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { useTripView, useTripWeather } from '../hooks/useTripView.js'
import { describeTrip } from '../lib/describe.js'
import { href, navigate, setQuery } from '../lib/router.js'
import { shareUrl } from '../lib/share.js'
import { formatDate } from '../lib/time.js'
import { BudgetTab } from './trip/BudgetTab.jsx'
import { ChecklistTab } from './trip/ChecklistTab.jsx'
import { FlightsTab } from './trip/FlightsTab.jsx'
import { ItineraryTab } from './trip/ItineraryTab.jsx'
import { OverviewTab } from './trip/OverviewTab.jsx'
import { StayTab } from './trip/StayTab.jsx'
import '../styles/trip.css'

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'itinerary', label: 'Itinerary', icon: Route },
  { key: 'flights', label: 'Flights', icon: Plane },
  { key: 'stay', label: 'Stay', icon: BedDouble },
  { key: 'budget', label: 'Budget', icon: Wallet },
  { key: 'checklist', label: 'Checklist', icon: ListChecks },
]
const DAY = 86400000

function tripStatus(ctx, now) {
  if (now < ctx.outbound.depart - DAY) {
    const days = Math.ceil((ctx.outbound.depart - now) / DAY)
    return { key: 'upcoming', label: days <= 1 ? 'Tomorrow' : `In ${days} days`, emoji: '🗓️' }
  }
  if (now < ctx.inbound.arrive) return { key: 'live', label: now < ctx.outbound.depart ? 'Travel day' : 'Happening now', emoji: '🟢' }
  return { key: 'past', label: 'Completed', emoji: '✅' }
}

function TitleEditor({ trip, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(trip.title)
  const inputRef = useRef(null)
  if (!editing) {
    return (
      <h1 className="trip-title">
        {trip.title}{' '}
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm trip-title-edit"
          aria-label="Rename trip"
          onClick={() => {
            setValue(trip.title)
            setEditing(true)
            requestAnimationFrame(() => inputRef.current?.select())
          }}
        >
          <Pencil aria-hidden="true" />
        </button>
      </h1>
    )
  }
  const save = () => {
    const v = value.trim()
    if (v && v !== trip.title) onSave(v)
    setEditing(false)
  }
  return (
    <form
      className="trip-title-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label htmlFor="trip-title-input" className="sr-only">
        Trip name
      </label>
      <input id="trip-title-input" ref={inputRef} className="input trip-title-input" value={value} maxLength={80} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setEditing(false)} />
      <button type="submit" className="btn btn-primary btn-icon btn-sm" aria-label="Save name">
        <Check aria-hidden="true" />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Cancel renaming" onClick={() => setEditing(false)}>
        <X aria-hidden="true" />
      </button>
    </form>
  )
}

function FitDialog({ fit, onClose, onApply, fmt }) {
  return (
    <Dialog
      open={Boolean(fit)}
      onClose={onClose}
      variant="modal"
      eyebrow="Fit to budget"
      title={fit?.changes.length ? `Save ${fmt.money(fit.before - fit.after)}` : 'Nothing left to trim'}
      description={fit ? `Lift Off looked for the changes that cost you the least — cheaper flights at sensible hours, a comparable stay, similar stops nearby.` : ''}
      footer={
        fit?.changes.length ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Keep my plan
            </button>
            <button type="button" className="btn btn-primary" onClick={onApply}>
              <PiggyBank aria-hidden="true" /> Apply {fit.changes.length} change{fit.changes.length === 1 ? '' : 's'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-dark" onClick={onClose}>
            OK
          </button>
        )
      }
    >
      {fit && (
        <div className="stack">
          <div className="fit-totals">
            <span className="num fit-before">{fmt.money(fit.before)}</span>
            <ArrowRight aria-hidden="true" />
            <span className="num fit-after">{fmt.money(fit.after)}</span>
            <span className={`badge ${fit.fits ? 'badge-success' : 'badge-warning'}`}>{fit.fits ? 'Fits your budget' : 'Still a little over'}</span>
          </div>
          {fit.changes.length > 0 ? (
            <ol className="fit-list">
              {fit.changes.map((c, i) => (
                <li key={i}>
                  <span>
                    <Emoji>{c.kind === 'flight' ? '✈️' : c.kind === 'stay' ? '🛏️' : '🔁'}</Emoji> {c.label}
                  </span>
                  <span className="num fit-saving">−{fmt.money(c.saving)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Your plan is already as lean as it gets without dropping things. Try removing a stop, a shorter trip, or raising the budget.</p>
          )}
          {!fit.fits && fit.changes.length > 0 && <p className="muted small">To close the rest, remove a paid activity or shorten the trip by a night.</p>}
        </div>
      )}
    </Dialog>
  )
}

export function TripPage({ id, query }) {
  const view = useTripView(id)
  const { trip, dest, origin, schedules, budget, ctx, apply } = view
  const { deleteTrip, addTrip } = useTrips()
  const { push } = useToast()
  const fmt = useFormat()
  const now = useNow(60000)
  const dates = useMemo(() => (trip ? trip.days.map((d) => d.date) : []), [trip])
  const weather = useTripWeather(dest, dates)
  const [fit, setFit] = useState(null)
  const tabRefs = useRef({})
  usePageTitle(trip ? trip.title : 'Trip not found')

  if (!trip || !dest) {
    return (
      <div className="container page">
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🧳
          </span>
          <h1>We can’t find that trip</h1>
          <p>It might have been deleted, or it was planned on another device. Trips are saved in this browser.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn btn-primary" href="#/">
              Plan a new trip
            </a>
            <a className="btn btn-secondary" href="#/trips">
              My trips
            </a>
          </div>
        </div>
      </div>
    )
  }

  const tab = TABS.some((t) => t.key === query.tab) ? query.tab : 'overview'
  const dayIndex = Math.max(0, Math.min(schedules.length - 1, Number(query.day) || 0))
  const status = tripStatus(ctx, now)
  const issues = schedules.reduce((n, s) => n + s.issueCount, 0)
  const firstIssueDay = schedules.findIndex((s) => s.issueCount > 0)
  const goTo = (t, day) => setQuery({ tab: t, day: day ?? (t === 'itinerary' ? dayIndex : undefined) })

  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.key === tab)
    let n = null
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = TABS.length - 1
    if (n === null) return
    e.preventDefault()
    goTo(TABS[n].key)
    tabRefs.current[TABS[n].key]?.focus()
  }

  const share = async () => {
    const url = shareUrl(trip)
    try {
      if (navigator.share) {
        await navigator.share({ title: trip.title, text: `My Lift Off plan: ${trip.title}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      push({ title: 'Share link copied', body: 'It opens the planner with this trip’s route, dates and budget filled in.', emoji: '🔗', tone: 'success' })
    } catch (err) {
      if (err?.name !== 'AbortError') push({ title: 'Couldn’t copy the link', body: url, tone: 'warning', duration: 12000 })
    }
  }

  const downloadIcs = () => {
    const blob = new Blob([buildIcs(trip, dest, schedules)], { type: 'text/calendar;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${trip.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'trip'}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    push({ title: 'Calendar file ready', body: 'Open it to add every stop and flight to Google, Apple or Outlook calendar.', emoji: '📅', tone: 'success' })
  }

  const remove = () => {
    const copy = trip
    deleteTrip(trip.id)
    navigate('/trips')
    push({ title: `Deleted “${copy.title}”`, emoji: '🗑️', tone: 'info', action: { label: 'Undo', onClick: () => addTrip(copy) }, duration: 8000 })
  }

  const sortAll = () => {
    const res = smartSortAll(trip, dest)
    if (!res.changedDays) {
      push({ title: 'Already in the best order', body: 'Some issues need a swap or a different day instead.', emoji: '👌', tone: 'info' })
      return
    }
    apply(() => res.trip, {
      title: `Smart sort re-ordered ${res.changedDays} day${res.changedDays === 1 ? '' : 's'}`,
      body: res.travelBefore > res.travelAfter ? `${fmt.duration(res.travelBefore - res.travelAfter)} less travel.` : 'Fewer timing clashes.',
      emoji: '✨',
    })
  }

  const pace = PACES[trip.params.pace]

  return (
    <div className="trip-page">
      <div className="container">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="#/trips">
            <ChevronLeft aria-hidden="true" /> My trips
          </a>
        </nav>

        <header className="trip-hero">
          <Poster dest={dest} ratio="banner" className="trip-hero-poster" />
          <div className="trip-hero-shade" aria-hidden="true" />
          <div className="trip-hero-content">
            <p className="trip-route mono">
              {trip.originCode} <ArrowRight aria-hidden="true" className="icon-inline" /> {dest.airport.code}
              <span className={`trip-status status-${status.key}`}>
                {status.key === 'live' && <span className="live-dot" aria-hidden="true" />} {status.label}
              </span>
            </p>
            <TitleEditor trip={trip} onSave={(title) => apply((t) => ({ ...t, title, updatedAt: Date.now() }))} />
            <ul className="trip-meta list-plain">
              <li>
                <Emoji>📅</Emoji> {formatDate(trip.days[0].date, 'medium')} – {formatDate(trip.days[trip.days.length - 1].date, 'medium')}
              </li>
              <li>
                <Emoji>👥</Emoji> {trip.params.travelers} traveller{trip.params.travelers === 1 ? '' : 's'}
              </li>
              <li>
                <Emoji>{pace?.emoji}</Emoji> {pace?.label} pace
              </li>
              <li>
                <Emoji>💰</Emoji> {fmt.money(budget.total)} of {fmt.money(budget.budget)}
              </li>
            </ul>
          </div>
        </header>

        <div className="trip-actions">
          <a className="btn btn-primary" href={href(`/live/${trip.id}`)}>
            <Radio aria-hidden="true" /> Go live
          </a>
          <button type="button" className="btn btn-secondary" onClick={share}>
            <Share2 aria-hidden="true" /> Share
          </button>
          <button type="button" className="btn btn-secondary" onClick={downloadIcs}>
            <CalendarPlus aria-hidden="true" /> Add to calendar
          </button>
          <SpeakButton text={() => describeTrip({ trip, dest, origin, schedules, budget, ctx, fmt })} label="Read whole trip" className="btn btn-secondary" />
          <Menu
            label="More trip actions"
            icon={MoreHorizontal}
            buttonClassName="btn btn-ghost btn-icon"
            items={[
              { key: 'print', label: 'Print or save as PDF', icon: Printer, onSelect: () => window.print() },
              { separator: true },
              { key: 'delete', label: 'Delete trip', icon: Trash2, danger: true, onSelect: remove },
            ]}
          />
        </div>

        {(budget.status === 'over' || issues > 0) && (
          <div className="trip-alerts">
            {budget.status === 'over' && (
              <div className="callout callout-danger" role="status">
                <Wallet aria-hidden="true" />
                <div className="callout-body">
                  <p className="callout-title">{fmt.money(-budget.remaining)} over budget</p>
                  <p className="small">Flights and the stay are the biggest levers — Lift Off can find the least painful savings.</p>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setFit(fitToBudget(trip, dest))}>
                  <PiggyBank aria-hidden="true" /> Fit to budget
                </button>
              </div>
            )}
            {issues > 0 && (
              <div className="callout callout-warning" role="status">
                <AlertTriangle aria-hidden="true" />
                <div className="callout-body">
                  <p className="callout-title">
                    {issues} timing issue{issues === 1 ? '' : 's'} to look at
                  </p>
                  <p className="small">Something’s closed, closes early, or a day runs long. Smart sort fixes most of these automatically.</p>
                </div>
                <div className="row" style={{ '--row-gap': '0.4rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => goTo('itinerary', firstIssueDay)}>
                    Show me
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={sortAll}>
                    <Wand2 aria-hidden="true" /> Smart sort all
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="tabs trip-tabs" role="tablist" aria-label="Trip sections" onKeyDown={onTabKey}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[key] = el
              }}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              className="tab"
              onClick={() => goTo(key)}
            >
              <Icon aria-hidden="true" />
              {label}
              {key === 'itinerary' && issues > 0 && <span className="badge badge-warning">{issues}</span>}
            </button>
          ))}
        </div>

        <div className="trip-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'overview' && <OverviewTab view={view} weather={weather} goTo={goTo} />}
          {tab === 'itinerary' && <ItineraryTab view={view} weather={weather} dayIndex={dayIndex} setDayIndex={(d) => setQuery({ tab: 'itinerary', day: d })} />}
          {tab === 'flights' && <FlightsTab view={view} />}
          {tab === 'stay' && <StayTab view={view} />}
          {tab === 'budget' && <BudgetTab key={`${fmt.currency}-${trip.params.budgetUSD}`} view={view} onFit={() => setFit(fitToBudget(trip, dest))} />}
          {tab === 'checklist' && <ChecklistTab view={view} weather={weather} />}
        </div>
      </div>

      <FitDialog
        fit={fit}
        fmt={fmt}
        onClose={() => setFit(null)}
        onApply={() => {
          const f = fit
          setFit(null)
          apply(() => f.trip, { title: `Saved ${fmt.money(f.before - f.after)}`, body: `${f.changes.length} change${f.changes.length === 1 ? '' : 's'} applied.`, emoji: '🐷' })
        }}
      />
    </div>
  )
}
