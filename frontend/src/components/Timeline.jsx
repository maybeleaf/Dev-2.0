import { AlertTriangle, ArrowDown, ArrowUp, BedDouble, CalendarDays, Clock3, Lock, LockOpen, Moon, MoreHorizontal, PlaneLanding, PlaneTakeoff, Shuffle, Trash2, Wand2 } from 'lucide-react'
import { CATEGORIES, MEALS, TAGS, TRANSPORT_MODES } from '../data/categories.js'
import { Menu } from './Menu.jsx'
import { Emoji, Glyph, PriceLevel, Rating } from './ui.jsx'
import { gapText, issueText, legText } from '../lib/describe.js'

const SHOW_TAGS = ['booking-advised', 'free', 'step-free', 'rainy-day', 'hidden-gem', 'views', 'vegetarian']

function StopRow({ stop, n, total, dest, fmt, travelers, onAction, active, onHover }) {
  const { act, item, issues } = stop
  const cat = CATEGORIES[act.category]
  const meal = act.category === 'food' ? MEALS[act.meal] : null
  const tz = dest.timezone
  const tags = (act.tags || []).filter((t) => SHOW_TAGS.includes(t) && !(t === 'free' && stop.cost === 0)).slice(0, 3)
  const hasFix = issues.some((i) => i.type !== 'closed')
  return (
    <li
      className={`tl-stop ${active ? 'is-active' : ''} ${issues.length ? 'has-issue' : ''} ${item.locked ? 'is-locked' : ''}`}
      style={{ '--c': `var(--cat-${act.category})` }}
      onMouseEnter={() => onHover?.(stop.key)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(stop.key)}
    >
      <div className="tl-time">
        <time className="mono" dateTime={new Date(stop.start).toISOString()}>
          {fmt.time(stop.start, tz)}
        </time>
        <span className="tl-time-end mono">{fmt.time(stop.end, tz)}</span>
      </div>
      <div className="tl-rail" aria-hidden="true">
        <span className="tl-num">{n}</span>
      </div>
      <article className="tl-card" aria-labelledby={`stop-${stop.key}`}>
        <header className="tl-card-head">
          <div className="tl-head-text">
            <p className="tl-kicker">
              <Glyph emoji={meal ? meal.emoji : cat.emoji} label={meal ? meal.label : cat.label} />
              {act.type && <span className="tl-type">· {act.type}</span>}
              {act.area && <span className="tl-area">· {act.area}</span>}
            </p>
            <h3 id={`stop-${stop.key}`} className="tl-name">
              <span className="sr-only">
                Stop {n} of {total}, {fmt.time(stop.start, tz)} to {fmt.time(stop.end, tz)}:{' '}
              </span>
              {act.name}
            </h3>
          </div>
          <div className="tl-actions">
            {item.locked && (
              <span className="badge badge-ink" title="Smart sort keeps pinned stops in place">
                <Lock aria-hidden="true" /> Pinned
              </span>
            )}
            <Menu
              label={`Options for ${act.name}`}
              icon={MoreHorizontal}
              items={[
                { key: 'swap', label: 'Swap for something similar', icon: Shuffle, onSelect: () => onAction('swap', stop) },
                { key: 'up', label: 'Move earlier', icon: ArrowUp, onSelect: () => onAction('up', stop), disabled: n === 1 },
                { key: 'down', label: 'Move later', icon: ArrowDown, onSelect: () => onAction('down', stop), disabled: n === total },
                { key: 'move', label: 'Move to another day…', icon: CalendarDays, onSelect: () => onAction('move', stop) },
                { key: 'lock', label: item.locked ? 'Unpin (let Smart sort move it)' : 'Pin in place', icon: item.locked ? LockOpen : Lock, onSelect: () => onAction('lock', stop) },
                { separator: true },
                { key: 'remove', label: 'Remove from plan', icon: Trash2, danger: true, onSelect: () => onAction('remove', stop) },
              ]}
            />
          </div>
        </header>
        <p className="tl-desc">{act.description}</p>
        <div className="tl-meta">
          <span>
            <Clock3 aria-hidden="true" /> {fmt.duration(act.duration)}
          </span>
          <span className={stop.cost === 0 ? 'tl-free' : ''}>{stop.cost === 0 ? 'Free' : `${fmt.money(stop.cost)}${travelers > 1 ? ` for ${travelers}` : ''}`}</span>
          {!act.generated && <Rating value={act.rating} />}
          {act.priceLevel && act.category === 'food' && <PriceLevel level={act.priceLevel} />}
          {act.cuisine && act.cuisine !== 'Local' && <span className="muted">{act.cuisine}</span>}
          {tags.map((t) => (
            <span key={t} className={`badge ${t === 'booking-advised' ? 'badge-warning' : ''}`}>
              {TAGS[t]}
            </span>
          ))}
        </div>
        {issues.length > 0 && (
          <div className="tl-issues" role="note">
            <AlertTriangle aria-hidden="true" />
            <ul className="list-plain">
              {issues.map((iss) => (
                <li key={iss.type}>{issueText(iss, fmt, stop, tz)}</li>
              ))}
            </ul>
            <div className="tl-issue-fix">
              {issues.some((i) => i.type === 'closed') && (
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onAction('move', stop)}>
                  <CalendarDays aria-hidden="true" /> Move day
                </button>
              )}
              {hasFix && (
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onAction('sort', stop)}>
                  <Wand2 aria-hidden="true" /> Smart sort
                </button>
              )}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => onAction('swap', stop)}>
                <Shuffle aria-hidden="true" /> Swap
              </button>
            </div>
          </div>
        )}
      </article>
    </li>
  )
}

/** One day's plan: fixed travel events, legs between stops, waits and the stops themselves. */
export function Timeline({ schedule, dest, stay, fmt, travelers, onAction, activeKey, onHover }) {
  const tz = dest.timezone
  const total = schedule.stops.length
  // Travel events and legs sit between stops but don't get a number.
  const stopNumber = new Map()
  for (const e of schedule.entries) if (e.kind === 'stop') stopNumber.set(e.key, stopNumber.size + 1)
  return (
    <ol className="timeline list-plain">
      {schedule.entries.map((e) => {
        if (e.kind === 'stop') {
          return <StopRow key={e.key} stop={e} n={stopNumber.get(e.key)} total={total} dest={dest} fmt={fmt} travelers={travelers} onAction={onAction} active={activeKey === e.key} onHover={onHover} />
        }
        if (e.kind === 'flight') {
          const f = e.flight
          return (
            <li key={e.key} className="tl-event tl-flight">
              <div className="tl-time">
                <time className="mono">{e.arriving ? fmt.time(f.arrive, tz) : fmt.time(f.depart, tz)}</time>
              </div>
              <div className="tl-rail" aria-hidden="true">
                <span className="tl-icon">{e.arriving ? <PlaneLanding /> : <PlaneTakeoff />}</span>
              </div>
              <div className="tl-event-body">
                <p className="tl-event-title">
                  {e.arriving ? `Land in ${dest.name}` : `Fly home to ${f.to.city}`} <span className="muted">· {f.airline.name} {f.flightNo}</span>
                </p>
                <p className="muted small">
                  {e.arriving
                    ? `${f.from.code} → ${f.to.code} · left ${fmt.time(f.depart, f.from.timezone)} ${f.from.city} time · ${fmt.duration(f.durationMin)}${f.stops ? ` via ${f.via.code}` : ' nonstop'}`
                    : `Departs ${f.from.code} at ${fmt.time(f.depart, tz)} · lands ${fmt.time(f.arrive, f.to.timezone)} ${f.to.city} time`}
                </p>
              </div>
            </li>
          )
        }
        if (e.kind === 'stay') {
          return (
            <li key={e.key} className="tl-event tl-stay">
              <div className="tl-time">
                <time className="mono">{fmt.time(e.start, tz)}</time>
              </div>
              <div className="tl-rail" aria-hidden="true">
                <span className="tl-icon">
                  <BedDouble />
                </span>
              </div>
              <div className="tl-event-body">
                <p className="tl-event-title">Drop your bags at {stay.title}</p>
                <p className="muted small">
                  {stay.neighborhood} · {e.early ? `check-in is from ${fmt.hours(stay.checkIn)} — most hosts happily hold luggage` : `check-in from ${fmt.hours(stay.checkIn)}`}
                </p>
              </div>
            </li>
          )
        }
        if (e.kind === 'gap') {
          return (
            <li key={e.key} className="tl-gap">
              <div className="tl-time" />
              <div className="tl-rail" aria-hidden="true" />
              <p className="tl-gap-text">
                <Emoji>{e.afterArrival ? '🧳' : e.reason === 'meal' ? '☕' : e.reason === 'evening' ? '🌇' : '🚶'}</Emoji> {gapText(e, fmt, tz)}
              </p>
            </li>
          )
        }
        if (e.kind === 'leg') {
          const mode = TRANSPORT_MODES[e.mode] || TRANSPORT_MODES.walk
          return (
            <li key={e.key} className={`tl-leg mode-${e.mode} ${e.transfer ? 'is-transfer' : ''}`}>
              <div className="tl-time">{e.transfer && <time className="mono">{fmt.time(e.start, tz)}</time>}</div>
              <div className="tl-rail" aria-hidden="true" />
              <p className="tl-leg-text">
                <Glyph emoji={mode.emoji} label={e.transfer ? (e.key === 'transfer-in' ? 'From the airport' : 'To the airport') : mode.label} />
                <span className="tl-leg-detail">
                  {e.key === 'transfer-out' ? `Leave for the airport · ${legText(e, fmt)}` : e.home ? `Back to your stay · ${legText(e, fmt)}` : legText(e, fmt)}
                  {e.cost > 0 && <span className="muted"> · {fmt.money(e.cost)}</span>}
                </span>
              </p>
            </li>
          )
        }
        return null
      })}
      {schedule.overrunMin > 10 && (
        <li className="tl-gap tl-overrun">
          <div className="tl-time" />
          <div className="tl-rail" aria-hidden="true" />
          <p className="tl-gap-text">
            <AlertTriangle aria-hidden="true" className="icon-inline" /> This day runs {fmt.duration(schedule.overrunMin)} past {schedule.window.departure ? 'the time you need to leave for the airport' : 'a comfortable end'} — remove or move a stop.
          </p>
        </li>
      )}
      {schedule.freeEndMin >= 60 && !schedule.window.departure && total > 0 && (
        <li className="tl-gap tl-end">
          <div className="tl-time">
            <time className="mono">{fmt.time(schedule.stats.endAt, tz)}</time>
          </div>
          <div className="tl-rail" aria-hidden="true">
            <span className="tl-icon">
              <Moon />
            </span>
          </div>
          <p className="tl-gap-text">Evening’s yours — {fmt.duration(schedule.freeEndMin)} free before bed.</p>
        </li>
      )}
    </ol>
  )
}
