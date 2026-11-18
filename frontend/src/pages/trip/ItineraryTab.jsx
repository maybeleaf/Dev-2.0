import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Clock3, Footprints, Plus, RefreshCw, Search, Shuffle, Wallet, Wand2 } from 'lucide-react'
import { Dialog } from '../../components/Dialog.jsx'
import { RouteMap } from '../../components/RouteMap.jsx'
import { SpeakButton } from '../../components/SpeakButton.jsx'
import { Timeline } from '../../components/Timeline.jsx'
import { CategoryChip, Emoji, Glyph, PriceLevel, Rating } from '../../components/ui.jsx'
import { CATEGORIES, CATEGORY_KEYS, MEALS, WEATHER } from '../../data/categories.js'
import { addItem, alternativesFor, moveItem, moveItemToDay, regenerateDay, removeItem, replaceItem, smartSortDay, toggleLock, usedRefs } from '../../engine/edit.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useFormat } from '../../hooks/useFormat.js'
import { dayTitle, describeDay } from '../../lib/describe.js'
import { formatDate } from '../../lib/time.js'

function DayStrip({ schedules, weather, dayIndex, onSelect }) {
  const refs = useRef([])
  const onKeyDown = (e) => {
    const n = schedules.length
    let next = null
    if (e.key === 'ArrowRight') next = (dayIndex + 1) % n
    else if (e.key === 'ArrowLeft') next = (dayIndex - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    if (next === null) return
    e.preventDefault()
    onSelect(next)
    refs.current[next]?.focus()
  }
  return (
    <div className="day-strip" role="tablist" aria-label="Choose a day" onKeyDown={onKeyDown}>
      {schedules.map((s, i) => {
        const wx = weather.days[i]
        return (
          <button
            key={s.date}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`day-tab-${i}`}
            aria-selected={i === dayIndex}
            aria-controls="day-panel"
            tabIndex={i === dayIndex ? 0 : -1}
            className="day-pill"
            onClick={() => onSelect(i)}
          >
            <span className="day-pill-n">Day {i + 1}</span>
            <span className="day-pill-date">
              {formatDate(s.date, 'weekday')} {Number(s.date.slice(8))}
            </span>
            {wx && (
              <span className="day-pill-wx">
                <Emoji>{WEATHER[wx.condition]?.emoji}</Emoji>
                <span className="sr-only">{WEATHER[wx.condition]?.label}, </span>
                {wx.high}°
              </span>
            )}
            {s.issueCount > 0 && <span className="day-pill-issue" aria-label={`${s.issueCount} timing issue${s.issueCount === 1 ? '' : 's'}`} />}
          </button>
        )
      })}
    </div>
  )
}

function SwapDialog({ open, onClose, options, current, onPick, fmt, travelers }) {
  return (
    <Dialog open={open} onClose={onClose} eyebrow="Swap a stop" title={current ? `Instead of ${current.name}…` : 'Swap'} description="Similar options nearby that aren’t in your plan yet.">
      {options.length === 0 ? (
        <p className="muted">Nothing similar left — you’ve already got the best of this category in your trip.</p>
      ) : (
        <ul className="pick-list list-plain">
          {options.map((a) => (
            <li key={a.id} className="pick-item" style={{ '--c': `var(--cat-${a.category})` }}>
              <div className="pick-main">
                <p className="pick-name">{a.name}</p>
                <p className="muted small">
                  {a.type} · {a.area} · {a.distanceFromCurrent < 1 ? `${Math.round(a.distanceFromCurrent * 1000)} m` : `${a.distanceFromCurrent.toFixed(1)} km`} away
                </p>
                <p className="pick-meta small">
                  <Rating value={a.rating} /> · {a.cost ? `${fmt.money(a.cost * travelers)}${travelers > 1 ? ` for ${travelers}` : ''}` : 'Free'} · {fmt.duration(a.duration)}
                  {a.priceLevel && a.category === 'food' && (
                    <>
                      {' '}
                      · <PriceLevel level={a.priceLevel} />
                    </>
                  )}
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPick(a)}>
                <Shuffle aria-hidden="true" /> Swap in
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

function MoveDialog({ open, onClose, schedules, fromDay, act, onPick }) {
  return (
    <Dialog open={open} onClose={onClose} variant="modal" eyebrow="Move a stop" title={act ? `Move ${act.name} to…` : 'Move'} description="We’ll slot it into the best spot on that day.">
      <ul className="pick-list list-plain">
        {schedules.map((s, i) => {
          const closed = act?.closedDays?.includes(s.window.dow)
          return (
            <li key={s.date}>
              <button type="button" className="pick-day" disabled={i === fromDay} onClick={() => onPick(i)}>
                <span className="pick-day-n">Day {i + 1}</span>
                <span className="pick-day-date">{formatDate(s.date, 'medium')}</span>
                <span className="muted small">
                  {i === fromDay ? 'Current day' : `${s.stops.length} stop${s.stops.length === 1 ? '' : 's'}${s.window.hours < 6 ? ' · short day' : ''}`}
                </span>
                {closed && <span className="badge badge-warning">Closed that day</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}

function AddStopDialog({ open, onClose, dest, trip, onPick, fmt, travelers }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const used = useMemo(() => usedRefs(trip), [trip])
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return dest.activities
      .filter((a) => !used.has(a.id))
      .filter((a) => cat === 'all' || (cat === 'free' ? a.cost === 0 : a.category === cat))
      .filter((a) => !needle || `${a.name} ${a.type} ${a.area} ${a.description} ${a.cuisine || ''}`.toLowerCase().includes(needle))
      .sort((a, b) => b.rating - a.rating)
  }, [dest, used, q, cat])
  return (
    <Dialog open={open} onClose={onClose} eyebrow="Add a stop" title={`More to do in ${dest.name}`} description={`${list.length} idea${list.length === 1 ? '' : 's'} not in your plan yet`}>
      <div className="stack">
        <div className="input-group">
          <Search aria-hidden="true" />
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, area or cuisine" aria-label="Search activities" />
        </div>
        <div className="chip-scroll" role="group" aria-label="Filter by category">
          {['all', ...CATEGORY_KEYS, 'free'].map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c === 'all' ? 'All' : c === 'free' ? <Glyph emoji="🆓" label="Free" /> : <Glyph emoji={CATEGORIES[c].emoji} label={CATEGORIES[c].label} />}
            </button>
          ))}
        </div>
        <ul className="pick-list list-plain">
          {list.map((a) => (
            <li key={a.id} className="pick-item" style={{ '--c': `var(--cat-${a.category})` }}>
              <div className="pick-main">
                <p className="pick-name">{a.name}</p>
                <p className="small">
                  <CategoryChip category={a.category} emoji={a.category === 'food' ? MEALS[a.meal]?.emoji : CATEGORIES[a.category].emoji} label={a.category === 'food' ? MEALS[a.meal]?.label : CATEGORIES[a.category].label} /> <span className="muted">{a.area}</span>
                </p>
                <p className="muted small">{a.description}</p>
                <p className="pick-meta small">
                  <Rating value={a.rating} /> · {a.cost ? fmt.money(a.cost * travelers) : 'Free'} · {fmt.duration(a.duration)}
                  {a.dayTrip && ' · Day trip'}
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPick(a)}>
                <Plus aria-hidden="true" /> Add
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted">No matches — try another filter.</li>}
        </ul>
      </div>
    </Dialog>
  )
}

export function ItineraryTab({ view, weather, dayIndex, setDayIndex }) {
  const { trip, dest, schedules, ctx, apply } = view
  const fmt = useFormat()
  const { push } = useToast()
  const [activeKey, setActiveKey] = useState(null)
  const [swap, setSwap] = useState(null)
  const [move, setMove] = useState(null)
  const [adding, setAdding] = useState(false)
  const day = schedules[Math.min(dayIndex, schedules.length - 1)]
  const di = day.index
  const wx = weather.days[di]
  const travelers = trip.params.travelers

  const sortDay = () => {
    const { trip: next, result } = smartSortDay(trip, dest, di)
    if (!result.changed) {
      push({ title: 'Already in the best order', body: 'Nothing to improve on this day.', emoji: '👌', tone: 'info' })
      return
    }
    const saved = result.travelBefore - result.travelAfter
    apply(() => next, {
      title: saved > 0 ? `Saved ${fmt.duration(saved)} of travel` : 'Re-ordered around opening hours',
      body: `Day ${di + 1} re-ordered by Smart sort.`,
      emoji: '✨',
    })
  }

  const onAction = (type, stop) => {
    const uid = stop.item.uid
    if (type === 'up') apply((t) => moveItem(t, di, uid, -1))
    else if (type === 'down') apply((t) => moveItem(t, di, uid, 1))
    else if (type === 'lock') apply((t) => toggleLock(t, di, uid))
    else if (type === 'remove') apply((t) => removeItem(t, di, uid), { title: `Removed ${stop.act.name}`, emoji: '🗑️', tone: 'info' })
    else if (type === 'swap') setSwap({ uid, act: stop.act })
    else if (type === 'move') setMove({ uid, act: stop.act })
    else if (type === 'sort') sortDay()
  }

  const swapOptions = useMemo(() => (swap ? alternativesFor(trip, dest, di, swap.uid, 6) : []), [swap, trip, dest, di])
  const mapLabel = `Map of day ${di + 1}: ${day.stops.length} stops starting from your stay in ${ctx.stay.neighborhood}.`

  return (
    <div className="itinerary">
      <DayStrip schedules={schedules} weather={weather} dayIndex={di} onSelect={setDayIndex} />

      <section id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${di}`} className="day-panel">
        <div className="day-head">
          <div className="day-head-text">
            <p className="eyebrow">
              Day {di + 1} of {schedules.length} · {formatDate(day.date, 'long')}
            </p>
            <h2 className="day-title">{dayTitle(day)}</h2>
            <ul className="day-stats list-plain">
              {wx && (
                <li>
                  <Emoji>{WEATHER[wx.condition]?.emoji}</Emoji> {WEATHER[wx.condition]?.label} · {wx.high}° / {wx.low}°
                </li>
              )}
              <li>
                <CalendarDays aria-hidden="true" /> {day.stops.length} stop{day.stops.length === 1 ? '' : 's'}
              </li>
              {day.stats.walkKm > 0 && (
                <li>
                  <Footprints aria-hidden="true" /> {day.stats.walkKm} km walking
                </li>
              )}
              <li>
                <Clock3 aria-hidden="true" /> {fmt.duration(day.stats.travelMin)} getting around
              </li>
              <li>
                <Wallet aria-hidden="true" /> {fmt.money(day.stats.cost)}
              </li>
            </ul>
          </div>
          <div className="day-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={sortDay} disabled={day.stops.length < 2}>
              <Wand2 aria-hidden="true" /> Smart sort
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" /> Add a stop
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => apply((t) => regenerateDay(t, dest, di), { title: `Fresh ideas for day ${di + 1}`, emoji: '🎲', tone: 'info' })}
            >
              <RefreshCw aria-hidden="true" /> New ideas
            </button>
            <SpeakButton text={() => describeDay(day, dest, fmt, { weather: wx })} label="Read day" />
          </div>
        </div>

        <div className="itin-grid">
          <div className="itin-timeline">
            {day.stops.length === 0 && !day.window.arrival && !day.window.departure && (
              <div className="empty">
                <span className="empty-emoji emoji" aria-hidden="true">
                  🌤️
                </span>
                <h3>A blank day</h3>
                <p>Rest, wander, or add something you’ve been wanting to do.</p>
                <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                  <Plus aria-hidden="true" /> Add a stop
                </button>
              </div>
            )}
            <Timeline schedule={day} dest={dest} stay={ctx.stay} fmt={fmt} travelers={travelers} onAction={onAction} activeKey={activeKey} onHover={setActiveKey} />
          </div>
          <aside className="itin-map" aria-label="Day map">
            <RouteMap schedule={day} dest={dest} stay={ctx.stay} activeKey={activeKey} onHover={setActiveKey} label={mapLabel} />
            <div className="itin-stay card">
              <p className="eyebrow">Home base</p>
              <p className="itin-stay-title">{ctx.stay.title}</p>
              <p className="muted small">
                {ctx.stay.neighborhood} · {ctx.stay.distanceKm} km from the centre
              </p>
            </div>
          </aside>
        </div>
      </section>

      <SwapDialog
        open={Boolean(swap)}
        onClose={() => setSwap(null)}
        options={swapOptions}
        current={swap?.act}
        fmt={fmt}
        travelers={travelers}
        onPick={(a) => {
          const old = swap
          setSwap(null)
          apply((t) => replaceItem(t, di, old.uid, a.id), { title: `Swapped in ${a.name}`, body: `Replaced ${old.act.name}.`, emoji: '🔁' })
        }}
      />
      <MoveDialog
        open={Boolean(move)}
        onClose={() => setMove(null)}
        schedules={schedules}
        fromDay={di}
        act={move?.act}
        onPick={(to) => {
          const m = move
          setMove(null)
          apply((t) => smartSortDay(moveItemToDay(t, di, m.uid, to), dest, to).trip, { title: `Moved ${m.act.name} to day ${to + 1}`, emoji: '📅' })
        }}
      />
      <AddStopDialog
        open={adding}
        onClose={() => setAdding(false)}
        dest={dest}
        trip={trip}
        fmt={fmt}
        travelers={travelers}
        onPick={(a) => {
          setAdding(false)
          apply((t) => addItem(t, dest, di, a.id), { title: `Added ${a.name}`, body: `Slotted into day ${di + 1}.`, emoji: '➕' })
        }}
      />
    </div>
  )
}
