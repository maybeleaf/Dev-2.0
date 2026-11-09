import { AIRLINES, AIRCRAFT } from '../data/airlines.js'
import { HUBS } from '../data/airports.js'
import { haversineKm } from '../lib/geo.js'
import { createRng } from '../lib/random.js'
import { diffDays, epochToZoned, monthOf, zonedToEpoch } from '../lib/time.js'

const CRUISE_KMH = 830
const MIN = 60000

const segmentMinutes = (km) => Math.round((km / CRUISE_KMH) * 60 + 32)
const round5 = (n) => Math.round(n / 5) * 5

function pickHubs(from, to) {
  const direct = haversineKm(from.coords, to.coords)
  return HUBS.filter((h) => h.code !== from.code && h.code !== to.code)
    .map((h) => {
      const a = haversineKm(from.coords, h.coords)
      const b = haversineKm(h.coords, to.coords)
      return { hub: h, a, b, detour: (a + b) / direct }
    })
    .filter((h) => h.a > 300 && h.b > 300)
    .sort((x, y) => x.detour - y.detour)
    .slice(0, 4)
}

function aircraftFor(km, rng) {
  if (km < 2500) return rng.pick(AIRCRAFT.short)
  if (km < 6000) return rng.pick(AIRCRAFT.medium)
  return rng.pick(AIRCRAFT.long)
}

function isPeak(date) {
  const m = monthOf(date)
  const d = Number(date.slice(8, 10))
  return m === 7 || m === 8 || (m === 6 && d >= 15) || (m === 12 && d >= 15) || (m === 1 && d <= 5)
}

/**
 * Builds one-way flight options. `from` / `to` are airports:
 * { code, city, coords, timezone }. `date` is the local departure date.
 */
export function generateFlights({ from, to, date, seed, direction, today }) {
  const rng = createRng(`${seed}|${direction}|${from.code}|${to.code}|${date}`)
  const km = haversineKm(from.coords, to.coords)
  const hubs = pickHubs(from, to)
  const nonstopShare = km < 4500 ? 0.55 : km < 11500 ? 0.34 : 0
  const count = 7
  const nonstopCount = Math.round(count * nonstopShare)
  const slots = rng
    .sample([6.1, 7.3, 8.6, 9.9, 11.4, 12.8, 14.2, 15.7, 17.1, 18.6, 20.1, 21.4, 22.7], count)
    .sort((a, b) => a - b)
  const stopPattern = rng.shuffle(Array.from({ length: count }, (_, i) => (i < nonstopCount ? 0 : 1)))
  const lead = Math.max(0, diffDays(today, date))
  const airlines = rng.sample(AIRLINES, 5)

  const options = slots.map((slot, i) => {
    const airline = airlines[i % airlines.length]
    const stops = hubs.length ? stopPattern[i] : 0
    const depHour = slot + rng.int(0, 4) * 0.083
    const depart = zonedToEpoch(date, Math.round(depHour * 12) / 12, from.timezone)
    let durationMin
    let via = null
    if (stops === 0) {
      durationMin = round5(segmentMinutes(km) + rng.int(-8, 14))
    } else {
      const h = hubs[Math.min(hubs.length - 1, rng.int(0, Math.min(2, hubs.length - 1)))]
      const layoverMin = rng.pick([65, 80, 95, 110, 130, 155, 185, 220])
      durationMin = round5(segmentMinutes(h.a) + layoverMin + segmentMinutes(h.b))
      via = { code: h.hub.code, city: h.hub.city, layoverMin }
    }

    let price = (70 + km * 0.065) * airline.factor
    if (stops === 0) price *= 1.16
    else if (via && via.layoverMin > 180) price *= 0.9
    if (depHour < 7.5 || depHour >= 21.5) price *= 0.9
    if (isPeak(date)) price *= 1.2
    if (lead < 14) price *= 1.22
    else if (lead < 30) price *= 1.08
    else if (lead > 120) price *= 0.95
    price *= rng.range(0.88, 1.15)
    price = Math.max(49, Math.round(price / 10) * 10 - 1)

    return {
      id: `${direction}-${i}`,
      direction,
      airline: { code: airline.code, name: airline.name, color: airline.color },
      flightNo: `${airline.code} ${rng.int(101, 989)}`,
      from: { code: from.code, city: from.city, timezone: from.timezone },
      to: { code: to.code, city: to.city, timezone: to.timezone },
      depart,
      arrive: depart + durationMin * MIN,
      durationMin,
      stops,
      via,
      distanceKm: Math.round(km),
      aircraft: aircraftFor(stops ? km / 2 : km, rng),
      price,
      bags: rng.chance(km > 4000 ? 0.75 : 0.35) ? '1 checked bag' : 'Carry-on only',
      co2Kg: Math.round(km * (stops ? 0.1 : 0.088)),
      seatsLeft: rng.chance(0.3) ? rng.int(2, 7) : null,
      gate: `${rng.pick(['A', 'B', 'C', 'D', 'E'])}${rng.int(2, 48)}`,
      tags: [],
    }
  })
  return tagFlights(options)
}

/** 0 = civilised hours; higher = pre-dawn departures or middle-of-night arrivals. */
export function flightInconvenience(f) {
  const dep = epochToZoned(f.depart, f.from.timezone).hours
  const arr = epochToZoned(f.arrive, f.to.timezone).hours
  let x = 0
  if (dep < 6.5) x += 1
  else if (dep < 8) x += 0.4
  if (dep >= 22.5) x += 0.5
  if (arr >= 0.5 && arr < 5.5) x += 0.7
  else if (arr >= 23) x += 0.3
  return x
}

/** Cheapest flight that doesn't wreck your sleep (≈ $80 per inconvenience point). */
export function cheapestSensible(options) {
  return options.reduce((a, b) => (b.price + flightInconvenience(b) * 80 < a.price + flightInconvenience(a) * 80 ? b : a))
}

export function tagFlights(options) {
  if (!options.length) return options
  const minPrice = Math.min(...options.map((o) => o.price))
  const minDur = Math.min(...options.map((o) => o.durationMin))
  const score = (o) => (o.price / minPrice) * 0.6 + (o.durationMin / minDur) * 0.4 + o.stops * 0.06 + flightInconvenience(o) * 0.22
  const cheapest = options.reduce((a, b) => (b.price < a.price ? b : a))
  const fastest = options.reduce((a, b) => (b.durationMin < a.durationMin ? b : a))
  const best = options.reduce((a, b) => (score(b) < score(a) ? b : a))
  return options.map((o) => ({
    ...o,
    tags: [o === best && 'best', o === cheapest && 'cheapest', o === fastest && 'fastest'].filter(Boolean),
  }))
}

/** Airport → minutes you should be at the gate area before departure. */
export const airportBufferMin = (flight) => (flight.distanceKm > 1500 ? 180 : 120)
