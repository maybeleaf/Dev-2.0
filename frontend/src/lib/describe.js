import { MEALS } from '../data/categories.js'
import { epochToZoned, formatDate } from './time.js'

// Human sentences for the UI and for read-aloud (TTS).

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function legText(e, fmt) {
  const d = fmt.duration(e.minutes)
  if (e.mode === 'walk') return e.minutes === 0 ? 'Right next door' : `Walk ${d}${e.km >= 0.3 ? ` · ${e.km.toFixed(1)} km` : ''}`
  return `${e.label} · ${d}`
}

export function issueText(issue, fmt, stop, tz) {
  if (issue.type === 'closed') return `Closed on ${WEEKDAYS[issue.dow]}s`
  if (issue.type === 'closes') return `Closes at ${fmt.hours(issue.hour)} — you’d still be there until ${fmt.time(stop.end, tz)}`
  if (issue.type === 'late-meal') return `${MEALS[issue.meal]?.label || 'Meal'} would start late (${fmt.time(stop.start, tz)})`
  if (issue.type === 'overrun') return 'Runs past the end of your day'
  return 'Timing issue'
}

export function gapText(e, fmt, tz) {
  const m = fmt.duration(e.minutes)
  if (e.afterArrival) return `${m} to settle in and freshen up`
  if (e.reason === 'meal') return `${m} free — ${MEALS[e.act.meal]?.label.toLowerCase() || 'the meal'} starts at ${fmt.time(e.end, tz)}`
  if (e.reason === 'evening') return `${m} free — ${e.act.name} is best from ${fmt.time(e.end, tz)}`
  return `${m} free — ${e.act.name} opens at ${fmt.time(e.end, tz)}`
}

/** "Belém & LX Factory" — the day's two biggest highlights. */
export function dayTitle(schedule) {
  const mains = schedule.stops
    .filter((s) => s.act.category !== 'food' && !s.act.generated)
    .sort((a, b) => (b.act.tags?.includes('iconic') ? 1 : 0) - (a.act.tags?.includes('iconic') ? 1 : 0) || b.act.rating - a.act.rating)
  if (schedule.window.arrival && mains.length === 0) return 'Arrival & settling in'
  if (schedule.window.departure && mains.length === 0) return 'Last bites & flight home'
  if (!mains.length) return schedule.stops.length ? 'Food & wandering' : 'A free day'
  const names = mains.slice(0, 2).map((s) => s.act.name.replace(/\s*\(.*\)$/, ''))
  return names.join(' & ')
}

export function describeDay(schedule, dest, fmt, { weather } = {}) {
  const tz = dest.timezone
  const parts = [`Day ${schedule.index + 1}, ${formatDate(schedule.date, 'long')}.`]
  if (weather) parts.push(`Expect around ${weather.high} degrees.`)
  if (schedule.window.arrival) parts.push(`You land at ${fmt.time(schedule.window.arrival.flight.arrive, tz)}.`)
  if (!schedule.stops.length) parts.push('Nothing planned — a free day.')
  schedule.stops.forEach((s, i) => {
    const lead = i === 0 ? 'Start' : i === schedule.stops.length - 1 ? 'Finish' : 'Then'
    parts.push(`${lead} at ${fmt.time(s.start, tz)} with ${s.act.name}${s.act.area ? ` in ${s.act.area}` : ''}.`)
    if (s.issues.length) parts.push(`Heads up: ${issueText(s.issues[0], fmt, s, tz)}.`)
  })
  if (schedule.window.departure) parts.push(`Leave for the airport by ${fmt.time(schedule.window.departure.leaveBy, tz)}.`)
  return parts.join(' ')
}

export function describeFlight(f, fmt, label = 'Flight') {
  return `${label}: ${f.airline.name} ${f.flightNo}, ${f.from.city} to ${f.to.city}. Departs ${formatDate(epochToZoned(f.depart, f.from.timezone).date, 'long')} at ${fmt.time(f.depart, f.from.timezone)} local time, arrives ${fmt.time(f.arrive, f.to.timezone)} local time. ${f.stops ? `One stop in ${f.via.city}.` : 'Nonstop.'} ${fmt.duration(f.durationMin)} in total.`
}

export function describeTrip({ trip, dest, origin, schedules, budget, ctx, fmt }) {
  const parts = [`${trip.title}, from ${origin?.city || trip.originCode}, for ${trip.params.travelers} ${trip.params.travelers === 1 ? 'traveller' : 'travellers'}.`]
  parts.push(describeFlight(ctx.outbound, fmt, 'Outbound flight'))
  parts.push(`You’re staying at ${ctx.stay.title} in ${ctx.stay.neighborhood}.`)
  if (budget) parts.push(`Estimated total ${fmt.money(budget.total)} against a budget of ${fmt.money(budget.budget)}.`)
  for (const s of schedules) parts.push(describeDay(s, dest, fmt))
  parts.push(describeFlight(ctx.inbound, fmt, 'Return flight'))
  return parts.join(' ')
}
