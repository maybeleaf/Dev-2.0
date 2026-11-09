import { MEALS, PACES } from '../data/categories.js'
import { dowOf, zonedToEpoch } from '../lib/time.js'
import { getCatalog } from './catalog.js'
import { airportBufferMin } from './flights.js'
import { airportLeg, computeLeg } from './transport.js'

const MIN = 60000
const HOUR = 3600000
export const DEPLANE_MIN = 45
export const BAG_DROP_MIN = 30
export const EVENING_START = 16

/** Sunset viewpoints, bars and shows wait for the evening even if you're early. */
export const eveningStartFor = (act) => (act.bestTime === 'evening' && act.category !== 'food' ? EVENING_START : null)

/** Resolves the selected flights / stay of a trip. */
export function tripContext(trip, dest) {
  return {
    params: trip.params,
    outbound: trip.flights.outbound.find((f) => f.id === trip.selected.outbound) || trip.flights.outbound[0],
    inbound: trip.flights.inbound.find((f) => f.id === trip.selected.inbound) || trip.flights.inbound[0],
    stay: trip.stays.find((s) => s.id === trip.selected.stay) || trip.stays[0],
    catalog: getCatalog(dest),
  }
}

/** The usable hours of a day, shortened by the arrival and departure flights. */
export function dayWindow(ctx, dest, dayIndex, dates) {
  const date = dates[dayIndex]
  const pace = PACES[ctx.params.pace] || PACES.balanced
  const midnight = zonedToEpoch(date, 0, dest.timezone)
  const legCtx = { travelers: ctx.params.travelers, mobility: ctx.params.mobility }
  let startH = pace.start
  let endH = pace.end
  let arrival = null
  let departure = null
  if (dayIndex === 0) {
    const transfer = airportLeg(dest, ctx.stay, legCtx)
    const leaveAirport = ctx.outbound.arrive + DEPLANE_MIN * MIN
    const atStay = leaveAirport + transfer.minutes * MIN
    startH = Math.max(startH, (atStay + BAG_DROP_MIN * MIN - midnight) / HOUR)
    arrival = { flight: ctx.outbound, transfer, leaveAirport, atStay }
  }
  if (dayIndex === dates.length - 1) {
    const transfer = airportLeg(dest, ctx.stay, legCtx)
    const buffer = airportBufferMin(ctx.inbound)
    const leaveBy = ctx.inbound.depart - (buffer + transfer.minutes) * MIN
    endH = Math.min(endH, (leaveBy - midnight) / HOUR)
    departure = { flight: ctx.inbound, transfer, leaveBy, buffer }
  }
  return { date, midnight, startH, endH, hours: Math.max(0, endH - startH), arrival, departure, dow: dowOf(date) }
}

/**
 * Lays out one day: legs, waits, stops and fixed travel events, with issues
 * flagged (closed that weekday, closes before you finish, late meal, overrun).
 */
export function scheduleDay({ dest, ctx, dates, dayIndex, items }) {
  const w = dayWindow(ctx, dest, dayIndex, dates)
  const { params, stay, catalog } = ctx
  const legCtx = { dest, travelers: params.travelers, mobility: params.mobility }
  const at = (h) => w.midnight + h * HOUR
  const hourOf = (epoch) => (epoch - w.midnight) / HOUR
  const entries = []
  const stops = []
  let travelMin = 0
  let walkKm = 0
  let cost = 0

  if (w.arrival) {
    const { flight, transfer, leaveAirport, atStay } = w.arrival
    entries.push({ kind: 'flight', key: 'arrive', flight, start: flight.depart, end: flight.arrive, arriving: true })
    entries.push({ kind: 'leg', key: 'transfer-in', ...transfer, start: leaveAirport, end: atStay, toLabel: stay.title, transfer: true })
    entries.push({ kind: 'stay', key: 'checkin', start: atStay, end: atStay + BAG_DROP_MIN * MIN, early: hourOf(atStay) < stay.checkIn, stay })
    travelMin += transfer.minutes
    cost += transfer.cost
  }

  let t = w.startH
  let pos = { coords: stay.coords }
  for (const item of items) {
    const act = catalog.get(item.ref)
    if (!act) continue
    const leg = computeLeg(pos, act, { ...legCtx, hour: t })
    if (leg.minutes > 0) {
      entries.push({ kind: 'leg', key: `leg-${item.uid}`, ...leg, start: at(t), end: at(t + leg.minutes / 60), toLabel: act.name })
    }
    travelMin += leg.minutes
    cost += leg.cost
    if (leg.mode === 'walk') walkKm += leg.km
    const arriveH = t + leg.minutes / 60
    const meal = act.category === 'food' && act.meal !== 'snack' ? MEALS[act.meal] : null
    let startH = arriveH
    if (meal) startH = Math.max(startH, meal.window[0])
    const eve = eveningStartFor(act)
    if (eve) startH = Math.max(startH, eve)
    startH = Math.max(startH, act.hours[0])
    const waitMin = Math.round((startH - arriveH) * 60)
    const endH = startH + act.duration / 60
    const issues = []
    if (act.closedDays?.includes(w.dow)) issues.push({ type: 'closed', dow: w.dow })
    else if (endH > act.hours[1] + 0.01) issues.push({ type: 'closes', hour: act.hours[1] })
    if (meal && startH > meal.window[1] + 0.01) issues.push({ type: 'late-meal', meal: act.meal })
    if (endH > w.endH + 0.01) issues.push({ type: 'overrun' })
    if (waitMin >= 20) {
      const reason = meal && startH === meal.window[0] ? 'meal' : eve && startH === eve ? 'evening' : 'opening'
      entries.push({ kind: 'gap', key: `gap-${item.uid}`, start: at(arriveH), end: at(startH), minutes: waitMin, reason, act, afterArrival: Boolean(w.arrival) && stops.length === 0 })
    }
    const groupCost = act.cost * params.travelers
    cost += groupCost
    const stop = { kind: 'stop', key: item.uid, item, act, start: at(startH), end: at(endH), waitMin, issues, cost: groupCost, leg }
    entries.push(stop)
    stops.push(stop)
    t = endH
    pos = act
  }

  // Head back to the stay (on the last day: to collect bags before the airport).
  if (stops.length) {
    const back = computeLeg(pos, { coords: stay.coords }, { ...legCtx, hour: t })
    if (back.minutes > 0) {
      entries.push({ kind: 'leg', key: 'leg-home', ...back, start: at(t), end: at(t + back.minutes / 60), toLabel: stay.title, home: true })
    }
    travelMin += back.minutes
    cost += back.cost
    if (back.mode === 'walk') walkKm += back.km
    t += back.minutes / 60
  }

  const limitH = w.endH
  const overrunMin = stops.length ? Math.max(0, Math.round((t - limitH) * 60)) : 0
  const freeEndMin = Math.max(0, Math.round((limitH - Math.max(t, w.startH)) * 60))

  if (w.departure) {
    const { flight, transfer, leaveBy } = w.departure
    entries.push({ kind: 'leg', key: 'transfer-out', ...transfer, start: leaveBy, end: leaveBy + transfer.minutes * MIN, toLabel: `${dest.airport.code} airport`, transfer: true })
    entries.push({ kind: 'flight', key: 'depart', flight, start: flight.depart, end: flight.arrive, arriving: false })
    travelMin += transfer.minutes
    cost += transfer.cost
  }

  const issueCount = stops.reduce((n, s) => n + s.issues.length, 0) + (overrunMin > 10 ? 1 : 0)
  return {
    date: w.date,
    index: dayIndex,
    window: w,
    entries,
    stops,
    overrunMin,
    freeEndMin,
    issueCount,
    stats: {
      travelMin,
      walkKm: Math.round(walkKm * 10) / 10,
      cost,
      stops: stops.length,
      startAt: stops[0]?.start ?? at(w.startH),
      endAt: at(t),
    },
  }
}

export function scheduleTrip(trip, dest) {
  const ctx = tripContext(trip, dest)
  const dates = trip.days.map((d) => d.date)
  return trip.days.map((day, i) => scheduleDay({ dest, ctx, dates, dayIndex: i, items: day.items }))
}
