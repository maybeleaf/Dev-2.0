import { epochToZoned } from '../lib/time.js'
import { airportBufferMin } from './flights.js'
import { tripContext } from './schedule.js'

const MIN = 60000
const HOUR = 3600000
export const HOME_TO_AIRPORT_MIN = 50

/**
 * Flattens a trip into timed events — check-in, leave-by, boarding, flights,
 * every stop and every "leave now" moment — for the live dashboard and alerts.
 */
export function buildTimeline(trip, dest, schedules) {
  const ctx = tripContext(trip, dest)
  const ob = ctx.outbound
  const ib = ctx.inbound
  const last = schedules[schedules.length - 1]
  const leaveIb = last?.window.departure?.leaveBy ?? ib.depart - (airportBufferMin(ib) + 40) * MIN
  const events = []
  const flight = (f, leg, leaveAt) => {
    events.push({ id: `${leg}-checkin`, at: f.depart - 24 * HOUR, kind: 'checkin', flight: f })
    events.push({ id: `${leg}-leave`, at: leaveAt, kind: 'leave', flight: f, leg })
    events.push({ id: `${leg}-boarding`, at: f.depart - 40 * MIN, kind: 'boarding', flight: f })
    events.push({ id: `${leg}-depart`, at: f.depart, kind: 'depart', flight: f, leg })
    events.push({ id: `${leg}-arrive`, at: f.arrive, kind: 'arrive', flight: f, leg })
  }
  flight(ob, 'out', ob.depart - (airportBufferMin(ob) + HOME_TO_AIRPORT_MIN) * MIN)
  schedules.forEach((s, dayIndex) => {
    for (const e of s.entries) {
      if (e.kind === 'stop') events.push({ id: `stop-${e.key}`, at: e.start, end: e.end, kind: 'stop', stop: e, dayIndex })
      else if (e.kind === 'leg' && e.minutes >= 8 && !e.transfer) events.push({ id: `leg-${e.key}-${dayIndex}`, at: e.start, end: e.end, kind: 'leg', leg: e, dayIndex })
    }
  })
  flight(ib, 'home', leaveIb)
  return events.sort((a, b) => a.at - b.at)
}

const PHASES = ['countdown', 'travel-day', 'to-airport', 'flying-out', 'on-trip', 'heading-home', 'flying-home', 'home']

export function getLiveState(trip, dest, schedules, timeline, now) {
  const ctx = tripContext(trip, dest)
  const ob = ctx.outbound
  const ib = ctx.inbound
  const find = (id) => timeline.find((e) => e.id === id)
  const leaveOut = find('out-leave').at
  const leaveHome = find('home-leave').at

  let phase
  if (now < ob.depart - 24 * HOUR) phase = 'countdown'
  else if (now < leaveOut) phase = 'travel-day'
  else if (now < ob.depart) phase = 'to-airport'
  else if (now < ob.arrive) phase = 'flying-out'
  else if (now < leaveHome) phase = 'on-trip'
  else if (now < ib.depart) phase = 'heading-home'
  else if (now < ib.arrive) phase = 'flying-home'
  else phase = 'home'

  const next = timeline.find((e) => e.at > now) || null
  const flying = phase === 'flying-out' ? ob : phase === 'flying-home' ? ib : null
  const flight = flying
    ? {
        f: flying,
        progress: Math.min(1, Math.max(0, (now - flying.depart) / (flying.arrive - flying.depart))),
        remainingMs: flying.arrive - now,
      }
    : null

  // During the trip: which day, what's happening now, what's next.
  const local = epochToZoned(now, dest.timezone)
  let dayIndex = schedules.findIndex((s) => s.date === local.date)
  if (dayIndex < 0) dayIndex = now < ob.arrive ? -1 : schedules.length
  const day = schedules[dayIndex]
  let current = null
  let upcoming = null
  if (phase === 'on-trip' && day) {
    const stop = day.stops.find((s) => s.start <= now && now < s.end)
    const leg = day.entries.find((e) => e.kind === 'leg' && e.start <= now && now < e.end)
    const gap = day.entries.find((e) => e.kind === 'gap' && e.start <= now && now < e.end)
    const block = stop || leg || gap
    if (block) current = { kind: block.kind, block, progress: (now - block.start) / (block.end - block.start), remainingMs: block.end - now }
    upcoming = day.stops.find((s) => s.start > now) || null
    if (!upcoming) {
      for (let i = dayIndex + 1; i < schedules.length && !upcoming; i++) upcoming = schedules[i].stops[0] || null
    }
  }
  const nextLeg = phase === 'on-trip' && day ? day.entries.find((e) => e.kind === 'leg' && e.start > now && e.minutes >= 1) : null

  const tripStart = ob.arrive
  const tripEnd = ib.depart
  const tripProgress = Math.min(1, Math.max(0, (now - tripStart) / (tripEnd - tripStart)))
  const dayProgress = day && day.stops.length
    ? Math.min(1, Math.max(0, (now - day.stats.startAt) / Math.max(1, day.stats.endAt - day.stats.startAt)))
    : 0
  const planned = Math.min(trip.createdAt, ob.depart - HOUR)
  const countdownProgress = Math.min(1, Math.max(0, (now - planned) / (ob.depart - planned)))

  let target = null
  if (phase === 'countdown' || phase === 'travel-day') target = { at: ob.depart, kind: 'depart', flight: ob }
  else if (phase === 'to-airport') target = { at: now < ob.depart - 40 * MIN ? ob.depart - 40 * MIN : ob.depart, kind: now < ob.depart - 40 * MIN ? 'boarding' : 'depart', flight: ob }
  else if (phase === 'flying-out') target = { at: ob.arrive, kind: 'arrive', flight: ob }
  else if (phase === 'on-trip') target = nextLeg && (!upcoming || nextLeg.start <= upcoming.start) ? { at: nextLeg.start, kind: 'leave', leg: nextLeg } : upcoming ? { at: upcoming.start, kind: 'stop', stop: upcoming } : { at: leaveHome, kind: 'leave-home' }
  else if (phase === 'heading-home') target = { at: ib.depart, kind: 'depart', flight: ib }
  else if (phase === 'flying-home') target = { at: ib.arrive, kind: 'arrive', flight: ib }

  return {
    phase,
    phaseIndex: PHASES.indexOf(phase),
    now,
    next,
    target: target && { ...target, ms: target.at - now },
    flight,
    dayIndex,
    day,
    current,
    upcoming,
    nextLeg,
    tripProgress,
    dayProgress,
    countdownProgress,
    outbound: ob,
    inbound: ib,
    leaveOut,
    leaveHome,
  }
}

/** Events crossed between two moments (for toasts / spoken alerts). */
export function crossedEvents(timeline, from, to) {
  if (to <= from) return []
  const crossed = timeline.filter((e) => e.at > from && e.at <= to && e.kind !== 'stop-end')
  // Time-machine jumps can cross dozens of events — only announce the latest.
  return crossed.length > 3 ? crossed.slice(-1) : crossed
}
