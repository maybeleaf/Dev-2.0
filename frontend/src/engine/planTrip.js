import { haversineKm } from '../lib/geo.js'
import { hashString, uid } from '../lib/random.js'
import { diffDays, epochToZoned, todayStr } from '../lib/time.js'
import { cheapestSensible, generateFlights } from './flights.js'
import { buildDays, tripDates } from './itinerary.js'
import { generateStays } from './stays.js'

export const MIN_FLIGHT_KM = 250
export const MAX_TRIP_DAYS = 21

export class PlanError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export const destinationAirport = (dest) => ({
  code: dest.airport.code,
  city: dest.name,
  name: dest.airport.name,
  coords: dest.airport.coords,
  timezone: dest.timezone,
})

/** Rough daily on-the-ground spend per person (meals, sights, transit). */
export const dailySpendPerPerson = (dest) =>
  dest.costs.mealMid * 1.6 + dest.costs.mealCheap * 0.6 + 16 + dest.costs.transitFare * 3 + dest.costs.coffee * 2

/** Quick estimate used by Explore cards and the planner's budget heuristics. */
export function estimateTripCost(dest, origin, { days, travelers, tier = 'mid' }) {
  const km = origin ? haversineKm(origin.coords, dest.airport.coords) : 3000
  const flight = (70 + km * 0.065) * 1.05 * 2
  const nights = Math.max(1, days - 1)
  const stay = dest.costs.stay[tier] * nights * (travelers > 2 ? 1 + (travelers - 2) * 0.3 : 1)
  return Math.round(flight * travelers + stay + dailySpendPerPerson(dest) * days * travelers)
}

export function validateParams(params, { origin, dest, today }) {
  const errors = {}
  if (!origin) errors.origin = 'Pick where you are starting from.'
  if (!dest) errors.destination = 'Pick a destination — or tap “Surprise me”.'
  if (!params.startDate) errors.startDate = 'Choose a start date.'
  if (!params.endDate) errors.endDate = 'Choose an end date.'
  if (params.startDate && params.startDate < today) errors.startDate = 'Start date can’t be in the past.'
  if (params.startDate && params.endDate) {
    const len = diffDays(params.startDate, params.endDate)
    if (len < 1) errors.endDate = 'End date needs to be after the start date.'
    else if (len + 1 > MAX_TRIP_DAYS) errors.endDate = `Trips can be up to ${MAX_TRIP_DAYS} days.`
  }
  if (origin && dest && haversineKm(origin.coords, dest.airport.coords) < MIN_FLIGHT_KM) {
    errors.destination = `${dest.name} is close enough to drive from ${origin.city} — try somewhere further.`
  }
  if (!(params.travelers >= 1 && params.travelers <= 6)) errors.travelers = 'Lift Off plans for 1–6 travellers.'
  if (!(params.budgetUSD > 0)) errors.budget = 'Set a budget so we can balance the plan.'
  return errors
}

/**
 * Builds a complete trip: flight options, bnb stays, and a day-by-day plan
 * balanced against the budget. Pure — same params + seed → same plan.
 */
export function planTrip(rawParams, { dest, origin, now = Date.now() }) {
  const today = todayStr(undefined, now)
  const params = {
    pace: 'balanced',
    mobility: 'standard',
    interests: ['sightseeing', 'food'],
    currency: 'USD',
    ...rawParams,
  }
  params.seed = params.seed || String(hashString(`${origin.code}|${dest.id}|${params.startDate}|${params.endDate}|${now}`) % 1e9)
  const travelers = params.travelers
  const destAirport = destinationAirport(dest)
  const outboundList = generateFlights({ from: origin, to: destAirport, date: params.startDate, seed: params.seed, direction: 'outbound', today })
  const inboundList = generateFlights({ from: destAirport, to: origin, date: params.endDate, seed: params.seed, direction: 'return', today })

  const days = diffDays(params.startDate, params.endDate) + 1
  const ground = dailySpendPerPerson(dest) * travelers * days
  const best = (list) => list.find((f) => f.tags.includes('best')) || list[0]
  const stayFloor = dest.costs.stay.budget * Math.max(1, days - 1) * (travelers > 2 ? 1 + (travelers - 2) * 0.3 : 1)
  let outbound = best(outboundList)
  let inbound = best(inboundList)
  if ((outbound.price + inbound.price) * travelers + stayFloor * 1.3 + ground > params.budgetUSD) {
    outbound = cheapestSensible(outboundList)
    inbound = cheapestSensible(inboundList)
  }
  // Long-haul overnight flights can land after the trip would end — pick the earliest arrival instead.
  const lastLocal = (f) => epochToZoned(f.depart, dest.timezone).date
  if (epochToZoned(outbound.arrive, dest.timezone).date > lastLocal(inbound)) {
    outbound = outboundList.reduce((a, b) => (b.arrive < a.arrive ? b : a))
  }
  if (epochToZoned(outbound.arrive, dest.timezone).date > lastLocal(inbound) || inbound.depart - outbound.arrive < 8 * 3600000) {
    inbound = inboundList.reduce((a, b) => (b.depart > a.depart ? b : a))
  }
  if (epochToZoned(outbound.arrive, dest.timezone).date > lastLocal(inbound) || inbound.depart - outbound.arrive < 8 * 3600000) {
    throw new PlanError('TOO_SHORT', `Getting to ${dest.name} takes most of that window — add a day or two to the trip.`)
  }

  const dates = tripDates(dest, outbound, inbound)
  const nights = Math.max(1, dates.length - 1)
  const stays = generateStays(dest, { seed: params.seed, nights })
  if (Math.max(...stays.map((s) => s.capacity)) < travelers) {
    const big = stays.filter((s) => s.entire).sort((a, b) => b.pricePerNight - a.pricePerNight)[0] || stays[0]
    big.capacity = 6
    big.bedrooms = 3
  }
  const fits = stays.filter((s) => s.capacity >= travelers)
  // Aim to spend ~75% of what's left on the stay: nice, but leaves breathing room.
  const stayBudget = params.budgetUSD - (outbound.price + inbound.price) * travelers - ground
  const target = stayBudget * 0.75
  const value = (s) =>
    s.rating * 2 - s.distanceKm * 0.12 + (s.superhost ? 0.15 : 0) - (stayBudget > 0 ? Math.abs(s.total - target) / stayBudget : 0)
  const affordable = fits.filter((s) => s.total <= stayBudget)
  const stay = affordable.length
    ? affordable.reduce((a, b) => (value(b) > value(a) ? b : a))
    : fits.reduce((a, b) => (b.total < a.total ? b : a))

  const estimate = (outbound.price + inbound.price) * travelers + stay.total + ground
  const ratio = params.budgetUSD / estimate
  params.budgetLevel = ratio < 1 ? 'tight' : ratio > 1.35 ? 'generous' : 'normal'

  const builtDays = buildDays({ params, dest, stay, outbound, inbound, seed: params.seed })
  return {
    id: uid('trip'),
    version: 1,
    createdAt: now,
    updatedAt: now,
    title: `${dates.length} days in ${dest.name}`,
    destinationId: dest.id,
    originCode: origin.code,
    params,
    flights: { outbound: outboundList, inbound: inboundList },
    stays,
    selected: { outbound: outbound.id, inbound: inbound.id, stay: stay.id },
    days: builtDays,
    checklist: {},
  }
}
