import { useEffect, useMemo, useRef } from 'react'
import { ArrowRight, BellRing, CalendarDays, ChevronLeft, Clock3, Footprints, ListChecks, MapPin, Radio, Wallet } from 'lucide-react'
import { BoardingPass } from '../components/BoardingPass.jsx'
import { FlightProgress } from '../components/FlightProgress.jsx'
import { Poster } from '../components/Poster.jsx'
import { SpeakButton } from '../components/SpeakButton.jsx'
import { SplitFlap } from '../components/SplitFlap.jsx'
import { TimeMachine } from '../components/TimeMachine.jsx'
import { Emoji, Glyph, Progress, Switch } from '../components/ui.jsx'
import { useClock, useNow } from '../context/ClockContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { CATEGORIES, MEALS, TRANSPORT_MODES } from '../data/categories.js'
import { DESTINATION_BY_ID } from '../data/index.js'
import { buildTimeline, crossedEvents, getLiveState, HOME_TO_AIRPORT_MIN } from '../engine/live.js'
import { buildChecklist } from '../engine/packing.js'
import { planTrip } from '../engine/planTrip.js'
import { useFormat } from '../hooks/useFormat.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { useSpeech } from '../hooks/useSpeech.js'
import { useTripView, useTripWeather } from '../hooks/useTripView.js'
import { gapText, legText } from '../lib/describe.js'
import { href, navigate, setQuery } from '../lib/router.js'
import { sampleTrip } from '../lib/sampleTrip.js'
import { describeCountdown, epochToZoned, formatCountdown, formatDate, todayStr } from '../lib/time.js'
import '../styles/live.css'

const MIN = 60000
const HOUR = 3600000
const DAY = 86400000
const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))

const PHASES = [
  { key: 'countdown', label: 'Countdown', emoji: '🗓️' },
  { key: 'travel-day', label: 'Travel day', emoji: '🧳' },
  { key: 'to-airport', label: 'To the airport', emoji: '🚕' },
  { key: 'flying-out', label: 'Flying out', emoji: '🛫' },
  { key: 'on-trip', label: 'On the trip', emoji: '📍' },
  { key: 'heading-home', label: 'Heading home', emoji: '🧭' },
  { key: 'flying-home', label: 'Flying home', emoji: '🛬' },
  { key: 'home', label: 'Home', emoji: '🏡' },
]

// Sky behind the hero follows the local hour where you are. Every pair keeps white text ≥ 4.5:1.
const SKIES = [
  { until: 5, name: 'night', top: '#0e1733', bottom: '#22305c' },
  { until: 7, name: 'dawn', top: '#24264f', bottom: '#8a4b5e' },
  { until: 10, name: 'morning', top: '#1c4b80', bottom: '#2f6aa3' },
  { until: 16, name: 'day', top: '#164a7d', bottom: '#2b6aa6' },
  { until: 18.5, name: 'golden', top: '#2a3f6b', bottom: '#9a5a2e' },
  { until: 20.5, name: 'dusk', top: '#231d44', bottom: '#7c3b3b' },
  { until: 24.01, name: 'night', top: '#0e1733', bottom: '#22305c' },
]

function skyAt(hour) {
  const sky = SKIES.find((s) => hour < s.until) || SKIES[0]
  const isSun = hour >= 5 && hour < 20.5
  const t = isSun ? (hour - 5) / 15.5 : ((hour - 20.5 + 24) % 24) / 8.5
  return { ...sky, orb: isSun ? 'sun' : 'moon', x: 8 + t * 84, y: 78 - Math.sin(Math.PI * t) * 58 }
}

const actEmoji = (a) => (a.category === 'food' ? MEALS[a.meal]?.emoji : CATEGORIES[a.category]?.emoji) || '📍'
const actLabel = (a) => (a.category === 'food' ? MEALS[a.meal]?.label : CATEGORIES[a.category]?.label) || 'Stop'

function eventTz(e, dest) {
  if (e.flight) return e.kind === 'arrive' ? e.flight.to.timezone : e.flight.from.timezone
  return dest.timezone
}

function eventCity(e, dest) {
  if (e.flight) return e.kind === 'arrive' ? e.flight.to.city : e.flight.from.city
  return dest.name
}

/** Copy for alerts and the "coming up" list. */
function eventInfo(e, { dest, fmt }) {
  const f = e.flight
  switch (e.kind) {
    case 'checkin':
      return { emoji: '🛂', label: 'Online check-in opens', title: 'Online check-in is open', body: `${f.airline.name} ${f.flightNo} — check in now to choose your seats.` }
    case 'leave':
      return e.leg === 'out'
        ? { emoji: '🚕', label: 'Leave for the airport', title: 'Time to leave for the airport', body: `Your flight leaves ${f.from.code} at ${fmt.time(f.depart, f.from.timezone)}. Allow about ${HOME_TO_AIRPORT_MIN} minutes to get there.` }
        : { emoji: '🧳', label: `Leave for ${f.from.code} airport`, title: `Time to head to ${f.from.code}`, body: `Your flight home leaves at ${fmt.time(f.depart, f.from.timezone)}.` }
    case 'boarding':
      return { emoji: '🎫', label: `Boarding · gate ${f.gate}`, title: `Boarding at gate ${f.gate}`, body: `${f.airline.name} ${f.flightNo} to ${f.to.city} is boarding now.` }
    case 'depart':
      return { emoji: '🛫', label: `Take-off ${f.from.code} → ${f.to.code}`, title: 'Wheels up!', body: `${f.from.city} → ${f.to.city}. Landing ${fmt.time(f.arrive, f.to.timezone)} local time.` }
    case 'arrive':
      return e.leg === 'out'
        ? { emoji: '🛬', label: `Land in ${f.to.city}`, title: `Welcome to ${dest.name}!`, body: `It’s ${fmt.time(e.at, dest.timezone)} local time. Your transfer and first stops are on the live page.` }
        : { emoji: '🏡', label: `Land in ${f.to.city}`, title: 'Welcome home', body: `Hope ${dest.name} was everything you wanted.` }
    case 'stop': {
      const a = e.stop.act
      return { emoji: actEmoji(a), label: a.name, title: `Now: ${a.name}`, body: `Until ${fmt.time(e.end, dest.timezone)}${a.area ? ` · ${a.area}` : ''}` }
    }
    case 'leg': {
      const m = TRANSPORT_MODES[e.leg.mode] || TRANSPORT_MODES.walk
      return e.leg.home
        ? { emoji: '🏠', label: `Back to ${e.leg.toLabel}`, title: `Head back to ${e.leg.toLabel}`, body: legText(e.leg, fmt) }
        : { emoji: m.emoji, label: `${m.label} to ${e.leg.toLabel}`, title: `Time to move — ${e.leg.toLabel}`, body: legText(e.leg, fmt) }
    }
    default:
      return null
  }
}

function describeLive(state, { dest, home, fmt }) {
  const { phase, now, target } = state
  const before = ['countdown', 'travel-day', 'to-airport', 'home'].includes(phase)
  const parts = [`It's ${fmt.time(now, before ? home.timezone : dest.timezone)} in ${before ? home.city : dest.name}.`]
  if (phase === 'countdown') parts.push(`Your flight to ${dest.name} leaves in ${describeCountdown(target.ms)}.`)
  if (phase === 'travel-day') parts.push(`It's travel day. Leave for the airport by ${fmt.time(state.leaveOut, home.timezone)}, in ${describeCountdown(state.leaveOut - now)}.`)
  if (phase === 'to-airport') parts.push(`Head to the airport. ${target.kind === 'boarding' ? 'Boarding' : 'Take-off'} is in ${describeCountdown(target.ms)}, from gate ${state.outbound.gate}.`)
  if (state.flight) parts.push(`You're in the air, ${Math.round(state.flight.progress * 100)} percent of the way to ${state.flight.f.to.city}. Landing in ${describeCountdown(state.flight.remainingMs)}.`)
  if (phase === 'on-trip') {
    const c = state.current
    if (c?.kind === 'stop') parts.push(`You're at ${c.block.act.name} for another ${describeCountdown(c.remainingMs)}.`)
    else if (c?.kind === 'leg') parts.push(`You're on the way to ${c.block.toLabel}.`)
    else if (c?.kind === 'gap') parts.push('This is free time.')
    if (target?.kind === 'leave') parts.push(`Leave in ${describeCountdown(target.ms)} for ${target.leg.toLabel}.`)
    else if (target?.kind === 'stop') parts.push(`Next up: ${target.stop.act.name}, in ${describeCountdown(target.ms)}.`)
    else if (target?.kind === 'leave-home') parts.push(`Next, head home. Leave for the airport in ${describeCountdown(target.ms)}.`)
  }
  if (phase === 'heading-home') parts.push(`Time to head home. Your flight leaves in ${describeCountdown(target.ms)}, from gate ${state.inbound.gate}.`)
  if (phase === 'home') parts.push(`You're home from ${dest.name}. Welcome back!`)
  return parts.join(' ')
}

// ——— Pieces ———

function PhaseSteps({ index }) {
  return (
    <ol className="live-steps list-plain" aria-label="Trip progress">
      {PHASES.map((p, i) => (
        <li key={p.key} className="live-step" data-state={i < index ? 'done' : i === index ? 'current' : 'todo'} aria-current={i === index ? 'step' : undefined}>
          <span className="live-step-dot" aria-hidden="true">
            {i < index ? '✓' : i + 1}
          </span>
          <span className="live-step-label">
            <Emoji>{p.emoji}</Emoji> {p.label}
            {i < index && <span className="sr-only"> (done)</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function LiveHero({ state, dest, home, fmt, schedules, here }) {
  const { phase, now, target, outbound: ob, inbound: ib } = state
  const sky = skyAt(epochToZoned(now, here.timezone).hours)
  let eyebrow
  let headline
  let flap = null
  let bars = []
  let facts = []
  let body = null

  if (phase === 'countdown') {
    eyebrow = `Next stop: ${dest.name}`
    headline = 'Take-off in'
    flap = { ms: target.ms, label: 'Time until take-off' }
    bars = [{ value: state.countdownProgress, label: 'Countdown to take-off', text: `${Math.round(state.countdownProgress * 100)}% of the wait done` }]
    facts = [`${ob.airline.name} ${ob.flightNo}`, `${fmt.epochDate(ob.depart, ob.from.timezone, 'medium')} · ${fmt.time(ob.depart, ob.from.timezone)}`, `Check-in opens in ${formatCountdown(ob.depart - DAY - now)}`]
  } else if (phase === 'travel-day') {
    eyebrow = 'It’s travel day'
    headline = `Leave for the airport by ${fmt.time(state.leaveOut, ob.from.timezone)}`
    flap = { ms: state.leaveOut - now, label: 'Time until you leave' }
    const v = clamp01((now - (ob.depart - DAY)) / (state.leaveOut - (ob.depart - DAY)))
    bars = [{ value: v, label: 'Travel day until you leave', text: `${Math.round(v * 100)}%` }]
    facts = ['Online check-in is open', `Gate ${ob.gate}`, ob.bags]
  } else if (phase === 'to-airport') {
    const boarding = target.kind === 'boarding'
    eyebrow = `Heading to ${ob.from.code}`
    headline = boarding ? `Boarding at ${fmt.time(ob.depart - 40 * MIN, ob.from.timezone)} · gate ${ob.gate}` : `Last call — gate ${ob.gate}`
    flap = { ms: target.ms, label: boarding ? 'Time until boarding' : 'Time until take-off' }
    const v = clamp01((now - state.leaveOut) / (ob.depart - state.leaveOut))
    bars = [{ value: v, label: 'Journey to take-off', text: `${Math.round(v * 100)}%` }]
    facts = [`${ob.airline.name} ${ob.flightNo}`, `Departs ${fmt.time(ob.depart, ob.from.timezone)}`, `Lands ${fmt.time(ob.arrive, ob.to.timezone)} ${ob.to.city} time`]
  } else if (state.flight) {
    const f = state.flight.f
    eyebrow = `In the air · ${f.airline.name} ${f.flightNo}`
    headline = `Landing in ${f.to.city} in ${formatCountdown(state.flight.remainingMs)}`
    body = <FlightProgress flight={f} progress={state.flight.progress} remainingMs={state.flight.remainingMs} fmt={fmt} />
    facts = [`It’s ${fmt.time(now, f.to.timezone)} in ${f.to.city}`, `${fmt.time(now, f.from.timezone)} in ${f.from.city}`]
  } else if (phase === 'on-trip') {
    const day = state.day
    const c = state.current
    eyebrow = day ? `Day ${state.dayIndex + 1} of ${schedules.length} · ${formatDate(day.date, 'long')}` : `In ${dest.name}`
    if (c?.kind === 'stop') headline = `Now: ${c.block.act.name}`
    else if (c?.kind === 'leg') headline = `On the way to ${c.block.toLabel}`
    else if (c?.kind === 'gap') headline = 'Free time — enjoy it'
    else if (day && day.stops.length && now < day.stats.startAt) headline = `Good morning, ${dest.name}`
    else if (day && day.stops.length) headline = 'Evening’s yours'
    else headline = `Settle into ${dest.name}`
    if (target) {
      const label = target.kind === 'leave' ? `Leave for ${target.leg.toLabel} in` : target.kind === 'stop' ? `${target.stop.act.name} starts in` : 'Leave for your flight home in'
      flap = { ms: target.ms, label, caption: label }
    }
    bars = [
      { value: state.dayProgress, label: 'Today', text: `${Math.round(state.dayProgress * 100)}% of today’s plan` },
      { value: state.tripProgress, label: 'Whole trip', text: `${Math.round(state.tripProgress * 100)}% of the trip` },
    ]
    if (day) facts = [`${day.stops.length} stop${day.stops.length === 1 ? '' : 's'} today`, day.stats.walkKm > 0 ? `${day.stats.walkKm} km on foot` : null, `${fmt.money(day.stats.cost)} planned`].filter(Boolean)
  } else if (phase === 'heading-home') {
    eyebrow = 'Heading home'
    headline = `Your flight home leaves at ${fmt.time(ib.depart, ib.from.timezone)}`
    flap = { ms: target.ms, label: 'Time until take-off' }
    const v = clamp01((now - state.leaveHome) / (ib.depart - state.leaveHome))
    bars = [{ value: v, label: 'Journey to take-off', text: `${Math.round(v * 100)}%` }]
    facts = [`Gate ${ib.gate}`, `${ib.airline.name} ${ib.flightNo}`, `Lands ${fmt.time(ib.arrive, ib.to.timezone)} ${ib.to.city} time`]
  } else {
    eyebrow = 'Trip complete'
    headline = `Welcome home from ${dest.name}`
    body = <p className="live-hero-note">Hope it was a good one. Your plan stays saved here — share it, or use it as a starting point for next time.</p>
  }

  return (
    <section className="live-hero" data-sky={sky.name} style={{ '--sky-top': sky.top, '--sky-bottom': sky.bottom, '--orb-x': `${sky.x}%`, '--orb-y': `${sky.y}%` }} aria-labelledby="live-headline">
      <span className={`live-orb is-${sky.orb}`} aria-hidden="true" />
      <span className="live-stars" aria-hidden="true" />
      <div className="live-hero-body">
        <p className="live-eyebrow">
          <span className="live-dot" aria-hidden="true" /> {eyebrow}
        </p>
        <h2 id="live-headline" className="live-headline">
          {headline}
        </h2>
        {flap && (flap.ms < 45 * DAY ? <SplitFlap ms={flap.ms} label={flap.label} /> : <p className="live-hero-note">{describeCountdown(flap.ms)}</p>)}
        {body}
        {bars.length > 0 && (
          <div className="live-bars">
            {bars.map((b) => (
              <div key={b.label} className="live-bar">
                <span className="live-bar-label">
                  {b.label} <span className="num">{Math.round(b.value * 100)}%</span>
                </span>
                <Progress value={b.value} label={b.label} valueText={b.text} size="lg" />
              </div>
            ))}
          </div>
        )}
        {facts.length > 0 && (
          <ul className="live-facts list-plain">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        Trip stage: {PHASES[state.phaseIndex]?.label}
      </p>
      <span className="live-here" aria-hidden="true">
        {fmt.time(now, here.timezone)} · {here.city === home.city ? `${here.city} (home)` : here.city}
      </span>
    </section>
  )
}

function NowCard({ state, dest, fmt }) {
  const c = state.current
  const tz = dest.timezone
  const day = state.day
  if (c?.kind === 'stop') {
    const s = c.block
    const a = s.act
    return (
      <section className="card card-pad live-now" style={{ '--c': `var(--cat-${a.category})` }} aria-labelledby="now-title">
        <p className="eyebrow">Happening now</p>
        <h2 id="now-title" className="live-card-title">
          <Glyph emoji={actEmoji(a)} label={actLabel(a)} /> {a.name}
        </h2>
        <p className="muted small">
          {fmt.time(s.start, tz)}–{fmt.time(s.end, tz)}
          {a.area ? ` · ${a.area}` : ''}
        </p>
        <Progress value={c.progress} label={`${a.name} so far`} valueText={`${formatCountdown(c.remainingMs)} left`} />
        <p className="live-left">
          <strong className="num">{formatCountdown(c.remainingMs)}</strong> left here
        </p>
        <p className="small">{a.description}</p>
      </section>
    )
  }
  if (c?.kind === 'leg') {
    const l = c.block
    const m = TRANSPORT_MODES[l.mode] || TRANSPORT_MODES.walk
    return (
      <section className="card card-pad live-now" aria-labelledby="now-title">
        <p className="eyebrow">On the move</p>
        <h2 id="now-title" className="live-card-title">
          <Glyph emoji={m.emoji} label={m.label} /> To {l.toLabel}
        </h2>
        <p className="muted small">{legText(l, fmt)}</p>
        <Progress value={c.progress} label="Journey so far" valueText={`Arrive in about ${formatCountdown(c.remainingMs)}`} />
        <p className="live-left">
          Arrive about <strong className="num">{fmt.time(l.end, tz)}</strong>
        </p>
      </section>
    )
  }
  if (c?.kind === 'gap') {
    return (
      <section className="card card-pad live-now" aria-labelledby="now-title">
        <p className="eyebrow">Right now</p>
        <h2 id="now-title" className="live-card-title">
          <Emoji>☕</Emoji> Free time
        </h2>
        <p className="small">{gapText(c.block, fmt, tz)}</p>
        <Progress value={c.progress} label="Free time so far" valueText={`${formatCountdown(c.remainingMs)} left`} />
        <p className="live-left">
          <strong className="num">{formatCountdown(c.remainingMs)}</strong> until the next thing
        </p>
      </section>
    )
  }
  const before = day && day.stops.length && state.now < day.stats.startAt
  return (
    <section className="card card-pad live-now" aria-labelledby="now-title">
      <p className="eyebrow">Right now</p>
      <h2 id="now-title" className="live-card-title">
        <Emoji>{before ? '🌅' : '🌙'}</Emoji> {before ? 'Nothing planned yet' : day?.stops.length ? 'Done for the day' : 'A free day'}
      </h2>
      <p className="small muted">{before ? `Your day starts at ${fmt.time(day.stats.startAt, tz)}. Coffee first?` : 'Wander, rest, or find somewhere for a nightcap. Everything else is tomorrow’s problem.'}</p>
    </section>
  )
}

function NextCard({ state, dest, fmt }) {
  const { target, upcoming, nextLeg } = state
  const tz = dest.timezone
  if (!target) return null
  if (target.kind === 'leave-home') {
    return (
      <section className="card card-pad live-next" aria-labelledby="next-title">
        <p className="eyebrow">Up next</p>
        <h2 id="next-title" className="live-card-title">
          <Emoji>🧳</Emoji> Head home
        </h2>
        <p className="live-count num">{formatCountdown(target.ms)}</p>
        <p className="muted small">Leave for the airport at {fmt.time(target.at, tz)}.</p>
      </section>
    )
  }
  if (target.kind === 'leave') {
    const l = target.leg
    const m = TRANSPORT_MODES[l.mode] || TRANSPORT_MODES.walk
    const after = upcoming && upcoming.start >= l.end && upcoming.act.name === l.toLabel ? upcoming : null
    return (
      <section className="card card-pad live-next" style={after ? { '--c': `var(--cat-${after.act.category})` } : undefined} aria-labelledby="next-title">
        <p className="eyebrow">{l.home ? 'Heading back' : 'Time to go soon'}</p>
        <h2 id="next-title" className="live-card-title">
          <Glyph emoji={m.emoji} label={m.label} /> {l.home ? `Back to ${l.toLabel}` : l.toLabel}
        </h2>
        <p className="live-count">
          <span className="muted small">Leave in</span> <span className="num">{formatCountdown(target.ms)}</span>
        </p>
        <p className="muted small">
          {fmt.time(l.start, tz)} · {legText(l, fmt)}
          {after ? ` · starts ${fmt.time(after.start, tz)}` : ''}
        </p>
      </section>
    )
  }
  const s = target.stop
  const a = s.act
  return (
    <section className="card card-pad live-next" style={{ '--c': `var(--cat-${a.category})` }} aria-labelledby="next-title">
      <p className="eyebrow">Up next</p>
      <h2 id="next-title" className="live-card-title">
        <Glyph emoji={actEmoji(a)} label={actLabel(a)} /> {a.name}
      </h2>
      <p className="live-count">
        <span className="muted small">Starts in</span> <span className="num">{formatCountdown(target.ms)}</span>
      </p>
      <p className="muted small">
        {fmt.time(s.start, tz)}
        {a.area ? ` · ${a.area}` : ''}
        {nextLeg && nextLeg.start < s.start ? ` · ${legText(nextLeg, fmt)} first` : ''}
      </p>
    </section>
  )
}

function TodayCard({ state, trip, dest, fmt }) {
  const day = state.day
  if (!day || !day.stops.length) return null
  const tz = dest.timezone
  const now = state.now
  const nextKey = day.stops.find((s) => s.start > now)?.key
  return (
    <section className="card card-pad" aria-labelledby="today-title">
      <div className="spread">
        <h2 id="today-title" className="card-title">
          <CalendarDays aria-hidden="true" className="icon-inline" /> Today
        </h2>
        <a className="link-btn" href={href(`/trip/${trip.id}`, { tab: 'itinerary', day: state.dayIndex })}>
          Open day <ArrowRight aria-hidden="true" className="icon-inline" />
        </a>
      </div>
      <ol className="live-today list-plain">
        {day.stops.map((s) => {
          const st = now >= s.end ? 'done' : now >= s.start ? 'now' : s.key === nextKey ? 'next' : 'later'
          return (
            <li key={s.key} className="live-today-row" data-state={st} style={{ '--c': `var(--cat-${s.act.category})` }}>
              <span className="live-today-time mono">{fmt.time(s.start, tz)}</span>
              <span className="live-today-mark" aria-hidden="true">
                {st === 'done' ? '✓' : ''}
              </span>
              <span className="live-today-name">
                {s.act.name}
                <span className="sr-only">{st === 'done' ? ' (done)' : st === 'now' ? ' (happening now)' : st === 'next' ? ' (next)' : ''}</span>
              </span>
              {st === 'now' && <span className="badge badge-success">Now</span>}
              {st === 'next' && <span className="badge badge-sky">Next</span>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function ChecklistCard({ trip, checklist }) {
  const v = checklist.total ? checklist.done / checklist.total : 0
  return (
    <section className="card card-pad" aria-labelledby="pack-title">
      <div className="spread">
        <h2 id="pack-title" className="card-title">
          <ListChecks aria-hidden="true" className="icon-inline" /> Before you go
        </h2>
        <a className="link-btn" href={href(`/trip/${trip.id}`, { tab: 'checklist' })}>
          Checklist <ArrowRight aria-hidden="true" className="icon-inline" />
        </a>
      </div>
      <p className="live-count num">
        {checklist.done}/{checklist.total} <span className="muted small">ready</span>
      </p>
      <Progress value={v} label="Packing checklist" valueText={`${checklist.done} of ${checklist.total} done`} tone={v === 1 ? 'success' : undefined} />
      <p className="muted small">{v === 1 ? 'All packed. Passport, phone, charger — go!' : 'Built from your forecast and plans: adaptor, documents, the right shoes.'}</p>
    </section>
  )
}

function FirstDayCard({ trip, schedules, dest, fmt }) {
  const day = schedules[0]
  const later = schedules[1]
  const show = day?.stops.length ? day : later
  if (!show) return null
  const idx = show === day ? 0 : 1
  const tz = dest.timezone
  return (
    <section className="card card-pad" aria-labelledby="first-title">
      <div className="spread">
        <h2 id="first-title" className="card-title">
          {idx === 0 ? 'When you land' : 'Your first full day'}
        </h2>
        <a className="link-btn" href={href(`/trip/${trip.id}`, { tab: 'itinerary', day: idx })}>
          Itinerary <ArrowRight aria-hidden="true" className="icon-inline" />
        </a>
      </div>
      {idx === 0 && day.window.arrival?.transfer && (
        <p className="small">
          <Emoji>{TRANSPORT_MODES[day.window.arrival.transfer.mode]?.emoji || '🚕'}</Emoji> Airport to your stay: {legText(day.window.arrival.transfer, fmt)}, arriving about {fmt.time(day.window.arrival.atStay, tz)}.
        </p>
      )}
      <ol className="live-today list-plain">
        {show.stops.slice(0, 5).map((s) => (
          <li key={s.key} className="live-today-row" data-state="later" style={{ '--c': `var(--cat-${s.act.category})` }}>
            <span className="live-today-time mono">{fmt.time(s.start, tz)}</span>
            <span className="live-today-mark" aria-hidden="true" />
            <span className="live-today-name">{s.act.name}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RecapCard({ trip, schedules, budget, dest, fmt, now }) {
  const done = schedules.flatMap((s) => s.stops).filter((s) => s.end <= now)
  const walked = schedules.reduce((k, s) => k + (s.stats.endAt <= now ? s.stats.walkKm : 0), 0)
  return (
    <section className="card card-pad" aria-labelledby="recap-title">
      <h2 id="recap-title" className="card-title">
        Trip so far
      </h2>
      <dl className="live-recap">
        <div>
          <dt>
            <CalendarDays aria-hidden="true" /> Days
          </dt>
          <dd className="num">{schedules.length}</dd>
        </div>
        <div>
          <dt>
            <MapPin aria-hidden="true" /> Stops visited
          </dt>
          <dd className="num">{done.length}</dd>
        </div>
        <div>
          <dt>
            <Footprints aria-hidden="true" /> Walked
          </dt>
          <dd className="num">{Math.round(walked * 10) / 10} km</dd>
        </div>
        <div>
          <dt>
            <Wallet aria-hidden="true" /> Estimated spend
          </dt>
          <dd className="num">{fmt.money(budget.total)}</dd>
        </div>
      </dl>
      <div className="row">
        <a className="btn btn-primary btn-sm" href="#/">
          Plan the next one
        </a>
        <a className="btn btn-secondary btn-sm" href={href(`/trip/${trip.id}`)}>
          Trip details
        </a>
        <a className="btn btn-ghost btn-sm" href={href('/destination/' + dest.id)}>
          About {dest.name}
        </a>
      </div>
    </section>
  )
}

function NextFlightCard({ state, fmt }) {
  const { now, outbound: ob, inbound: ib } = state
  const f = now < ob.arrive ? ob : now < ib.arrive ? ib : null
  if (!f) return null
  const out = f === ob
  const inAir = now >= f.depart
  const value = inAir ? (state.flight?.progress ?? 0) : out ? state.countdownProgress : state.tripProgress
  const label = inAir ? `Flight to ${f.to.city}` : out ? 'Countdown to your flight' : 'Until your flight home'
  return (
    <section className="card card-pad live-nextflight" style={{ '--airline': f.airline.color }} aria-labelledby="nf-title">
      <div className="spread">
        <h2 id="nf-title" className="card-title">
          {out ? 'Your flight out' : 'Your flight home'}
        </h2>
        <span className="badge badge-sky mono">{f.flightNo}</span>
      </div>
      <p className="live-nf-route mono">
        {f.from.code} <ArrowRight aria-hidden="true" className="icon-inline" /> {f.to.code}
      </p>
      <p className="live-count">
        <span className="muted small">{inAir ? 'Lands in' : 'Takes off in'}</span> <span className="num">{formatCountdown(inAir ? f.arrive - now : f.depart - now)}</span>
      </p>
      <Progress value={value} label={label} valueText={`${Math.round(value * 100)}%`} size="lg" />
      <p className="muted small">
        {fmt.epochDate(f.depart, f.from.timezone, 'medium')} · {fmt.time(f.depart, f.from.timezone)} {f.from.city} · gate {f.gate}
      </p>
    </section>
  )
}

function UpcomingCard({ timeline, now, dest, fmt }) {
  const items = timeline.filter((e) => e.at > now).slice(0, 6)
  return (
    <section className="card card-pad" aria-labelledby="up-title">
      <h2 id="up-title" className="card-title">
        <Clock3 aria-hidden="true" className="icon-inline" /> Coming up
      </h2>
      {items.length === 0 ? (
        <p className="muted small">That’s everything. Welcome home!</p>
      ) : (
        <ol className="live-upcoming list-plain">
          {items.map((e) => {
            const info = eventInfo(e, { dest, fmt })
            const tz = eventTz(e, dest)
            return (
              <li key={e.id}>
                <span className="live-up-emoji emoji" aria-hidden="true">
                  {info.emoji}
                </span>
                <span className="live-up-body">
                  <span className="live-up-title">{info.label}</span>
                  <span className="muted small">
                    {fmt.time(e.at, tz)}
                    {tz !== dest.timezone ? ` ${eventCity(e, dest)} time` : ''} · in {formatCountdown(e.at - now)}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function AlertsCard({ text }) {
  const { settings, update } = useSettings()
  return (
    <section className="card card-pad stack" style={{ '--stack-gap': '0.75rem' }} aria-labelledby="alerts-title">
      <h2 id="alerts-title" className="card-title">
        <BellRing aria-hidden="true" className="icon-inline" /> Alerts
      </h2>
      <p className="muted small">A note pops up at every key moment — check-in, leave-by, boarding, landing and each stop.</p>
      <Switch id="live-speak" label="Read alerts aloud" description={settings.tts ? 'Uses your read-aloud voice.' : 'Turn on read-aloud in Accessibility first.'} checked={settings.speakAlerts} onChange={(v) => update({ speakAlerts: v })} />
      <SpeakButton text={text} label="Read my status" />
    </section>
  )
}

// ——— The dashboard for one trip ———

function LiveDashboard({ view, query }) {
  const { trip, dest, origin, schedules, budget, ctx } = view
  const home = origin || ctx.outbound.from
  const fmt = useFormat()
  const now = useNow(1000)
  const { settings } = useSettings()
  const { push } = useToast()
  const { jumpTo, setSpeed, speed, getNow } = useClock()
  const { speak } = useSpeech('live-alerts')
  const timeline = useMemo(() => buildTimeline(trip, dest, schedules), [trip, dest, schedules])
  const state = getLiveState(trip, dest, schedules, timeline, now)
  const dates = useMemo(() => trip.days.map((d) => d.date), [trip])
  const weather = useTripWeather(dest, dates)
  const checklist = useMemo(() => {
    const items = buildChecklist(trip, dest, { weather: weather.days, schedules }).flatMap((g) => g.items)
    return { total: items.length, done: items.filter((i) => trip.checklist?.[i.key]).length }
  }, [trip, dest, weather.days, schedules])
  usePageTitle(`Live · ${trip.title}`)

  // Alerts for every event the clock passes (real time or time machine).
  const lastNow = useRef(null)
  useEffect(() => {
    const prev = lastNow.current
    lastNow.current = now
    if (prev === null) return
    for (const e of crossedEvents(timeline, prev, now)) {
      const info = eventInfo(e, { dest, fmt })
      if (!info) continue
      push({ title: info.title, body: info.body, emoji: info.emoji, tone: 'live', duration: 7000 })
      if (settings.speakAlerts && speed <= 60) speak(`${info.title}. ${info.body}`)
    }
  }, [now, timeline, dest, fmt, push, speak, settings.speakAlerts, speed])

  // ?demo=1 → start just before "leave for the airport", at 60×.
  const demoStarted = useRef(false)
  const leaveOut = state.leaveOut
  useEffect(() => {
    if (query.demo !== '1' || demoStarted.current) return
    demoStarted.current = true
    jumpTo(leaveOut - 30 * MIN)
    setSpeed(60)
    setQuery({ demo: undefined })
  }, [query.demo, leaveOut, jumpTo, setSpeed])

  const jumps = useMemo(() => {
    const ob = ctx.outbound
    const ib = ctx.inbound
    const leaveHome = timeline.find((e) => e.id === 'home-leave')?.at ?? ib.depart - 3 * HOUR
    const morning = (s) => (s.stops.length ? s.stats.startAt - 10 * MIN : s.window.midnight + 9 * HOUR)
    const list = [
      { key: 'before', label: 'Day before', emoji: '🗓️', at: ob.depart - DAY - 2 * MIN },
      { key: 'leave', label: 'Leave for airport', emoji: '🚕', at: leaveOut - MIN },
      { key: 'flight', label: 'Mid-flight', emoji: '✈️', at: ob.depart + (ob.arrive - ob.depart) / 2 },
    ]
    if (schedules[1]) list.push({ key: 'day2', label: 'Day 2 morning', emoji: '☀️', at: morning(schedules[1]) })
    if (schedules.length > 2) list.push({ key: 'last', label: 'Last day', emoji: '🧳', at: Math.min(morning(schedules[schedules.length - 1]), leaveHome - 90 * MIN) })
    list.push({ key: 'home', label: 'Flying home', emoji: '🛬', at: ib.depart + (ib.arrive - ib.depart) * 0.35 })
    return list
  }, [ctx, timeline, schedules, leaveOut])

  const before = ['countdown', 'travel-day', 'to-airport', 'home'].includes(state.phase)
  const here = before ? { timezone: home.timezone, city: home.city } : { timezone: dest.timezone, city: dest.name }
  const speech = () => describeLive(getLiveState(trip, dest, schedules, timeline, getNow()), { dest, home, fmt })
  const phase = state.phase

  return (
    <div className="container page live-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href(`/trip/${trip.id}`)}>
          <ChevronLeft aria-hidden="true" /> {trip.title}
        </a>
      </nav>

      <header className="live-head">
        <Poster dest={dest} ratio="square" className="live-head-poster" />
        <div className="live-head-text">
          <p className="eyebrow">
            <span className="live-dot" aria-hidden="true" /> Live dashboard
          </p>
          <h1 className="live-title">{trip.title}</h1>
          <p className="muted small">
            {formatDate(trip.days[0].date, 'medium')} – {formatDate(trip.days[trip.days.length - 1].date, 'medium')} · {home.city} → {dest.name}
          </p>
        </div>
        <div className="live-clocks" aria-label="Local times">
          {[
            { city: dest.name, tz: dest.timezone },
            { city: home.city, tz: home.timezone },
          ].map((c) => (
            <p key={c.city} className="live-clock">
              <span className="live-clock-city">{c.city}</span>
              <span className="live-clock-time mono">{fmt.time(now, c.tz)}</span>
              <span className="tiny muted">{fmt.epochDate(now, c.tz, 'medium')}</span>
            </p>
          ))}
        </div>
      </header>

      <PhaseSteps index={state.phaseIndex} />

      <LiveHero state={state} dest={dest} home={home} fmt={fmt} schedules={schedules} here={here} />

      <div className="live-grid">
        <div className="live-main stack" style={{ '--stack-gap': '1.25rem' }}>
          {phase === 'on-trip' && (
            <>
              <div className="live-pair">
                <NowCard state={state} dest={dest} fmt={fmt} />
                <NextCard state={state} dest={dest} fmt={fmt} />
              </div>
              <TodayCard state={state} trip={trip} dest={dest} fmt={fmt} />
            </>
          )}
          {['countdown', 'travel-day', 'to-airport'].includes(phase) && (
            <>
              <BoardingPass flight={ctx.outbound} fmt={fmt} travelers={trip.params.travelers} headingLevel={2} />
              <div className="live-pair">
                <ChecklistCard trip={trip} checklist={checklist} />
                <FirstDayCard trip={trip} schedules={schedules} dest={dest} fmt={fmt} />
              </div>
            </>
          )}
          {phase === 'flying-out' && (
            <>
              <FirstDayCard trip={trip} schedules={schedules} dest={dest} fmt={fmt} />
              <BoardingPass flight={ctx.outbound} fmt={fmt} travelers={trip.params.travelers} headingLevel={2} />
            </>
          )}
          {['heading-home', 'flying-home'].includes(phase) && (
            <>
              <BoardingPass flight={ctx.inbound} fmt={fmt} travelers={trip.params.travelers} headingLevel={2} />
              <RecapCard trip={trip} schedules={schedules} budget={budget} dest={dest} fmt={fmt} now={now} />
            </>
          )}
          {phase === 'home' && <RecapCard trip={trip} schedules={schedules} budget={budget} dest={dest} fmt={fmt} now={now} />}
        </div>

        <aside className="live-side stack" style={{ '--stack-gap': '1.25rem' }} aria-label="Flight and alerts">
          <NextFlightCard state={state} fmt={fmt} />
          <UpcomingCard timeline={timeline} now={now} dest={dest} fmt={fmt} />
          <AlertsCard text={speech} />
        </aside>
      </div>

      <TimeMachine jumps={jumps} tz={here.timezone} place={here.city} fmt={fmt} />
    </div>
  )
}

function LiveTrip({ id, query }) {
  const view = useTripView(id)
  if (!view.trip || !view.dest) {
    return (
      <div className="container page">
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            📡
          </span>
          <h1>No signal for that trip</h1>
          <p>It may have been deleted, or it was planned in another browser.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn btn-primary" href="#/live">
              Choose a trip
            </a>
            <a className="btn btn-secondary" href="#/">
              Plan a trip
            </a>
          </div>
        </div>
      </div>
    )
  }
  return <LiveDashboard view={view} query={query} />
}

// ——— /live with no trip chosen ———

function LivePicker() {
  const { trips, addTrip } = useTrips()
  const { settings } = useSettings()
  const { push } = useToast()
  const fmt = useFormat()
  const now = useNow(30000)
  usePageTitle('Live')

  const rows = useMemo(() => {
    const order = { live: 0, upcoming: 1, past: 2 }
    return trips
      .map((t) => {
        const dest = DESTINATION_BY_ID[t.destinationId]
        const ob = t.flights?.outbound.find((f) => f.id === t.selected.outbound)
        const ib = t.flights?.inbound.find((f) => f.id === t.selected.inbound)
        if (!dest || !ob || !ib) return null
        const status = now < ob.depart - DAY ? 'upcoming' : now < ib.arrive ? 'live' : 'past'
        return { trip: t, dest, ob, ib, status }
      })
      .filter(Boolean)
      .sort((a, b) => order[a.status] - order[b.status] || (a.status === 'past' ? b.ib.arrive - a.ib.arrive : a.ob.depart - b.ob.depart))
  }, [trips, now])

  const startDemo = () => {
    const s = sampleTrip({ homeAirport: settings.homeAirport, today: todayStr(), currency: fmt.currency, live: true })
    const trip = planTrip(s.params, { dest: s.dest, origin: s.origin })
    addTrip(trip)
    push({ title: `${trip.title} — planned!`, body: 'The time machine is on: use the dock to jump through the trip.', emoji: '🎉', tone: 'success' })
    navigate(`/live/${trip.id}`, { demo: 1 })
  }

  return (
    <div className="container page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <span className="live-dot" aria-hidden="true" /> Live
          </p>
          <h1>Your trip, in real time</h1>
          <p className="lede">Countdowns, leave-by alerts, flight progress and what’s next — updated every second while you travel.</p>
        </div>
      </header>

      {rows.length > 0 ? (
        <ul className="live-picker list-plain">
          {rows.map(({ trip, dest, ob, status }) => (
            <li key={trip.id}>
              <a className={`live-pick card card-hover is-${status}`} href={href(`/live/${trip.id}`)}>
                <Poster dest={dest} ratio="square" className="live-pick-poster" />
                <span className="live-pick-body">
                  <span className="live-pick-title">{trip.title}</span>
                  <span className="muted small">
                    {formatDate(trip.days[0].date, 'medium')} – {formatDate(trip.days[trip.days.length - 1].date, 'medium')}
                  </span>
                </span>
                <span className={`badge ${status === 'live' ? 'badge-success' : status === 'upcoming' ? 'badge-sky' : ''}`}>
                  {status === 'live' ? 'Live now' : status === 'upcoming' ? `In ${formatCountdown(ob.depart - now)}` : 'Completed'}
                </span>
                <ArrowRight aria-hidden="true" className="live-pick-arrow" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🛫
          </span>
          <h2>No trips yet</h2>
          <p>Plan one and this page becomes your travel-day co-pilot.</p>
          <a className="btn btn-primary" href="#/">
            Plan a trip
          </a>
        </div>
      )}

      <section className="live-demo card card-pad" aria-labelledby="demo-title">
        <div>
          <p className="eyebrow">Two-minute demo</p>
          <h2 id="demo-title">Watch a whole trip play out</h2>
          <p className="muted">We’ll plan a sample trip that leaves tomorrow, then fast-forward the clock: leave-by alert, boarding, the flight arc, every stop with “leave in” timers, and the flight home.</p>
        </div>
        <button type="button" className="btn btn-dark btn-lg" onClick={startDemo}>
          <Radio aria-hidden="true" /> Start the live demo
        </button>
      </section>
    </div>
  )
}

export function LivePage({ id, query = {} }) {
  if (!id) return <LivePicker />
  return <LiveTrip id={id} query={query} />
}
