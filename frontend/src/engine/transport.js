import { haversineKm } from '../lib/geo.js'

const ROUTE_FACTOR = 1.25 // streets are never a straight line

/**
 * Chooses how to get between two points and what it costs the whole group.
 * ctx = { dest, travelers, mobility, hour }  (hour = local decimal hour of departure)
 */
export function computeLeg(fromPoint, toPoint, ctx) {
  const { dest, travelers = 1, mobility = 'standard', hour = 12 } = ctx
  const straight = haversineKm(fromPoint.coords, toPoint.coords)
  const km = straight * ROUTE_FACTOR
  if (straight < 0.08) return { mode: 'walk', minutes: 0, km: 0, cost: 0, label: 'Right next door' }

  if (fromPoint.dayTrip || toPoint.dayTrip) {
    const minutes = Math.round((km / 55) * 60 + 15)
    return { mode: 'tour', minutes, km, cost: Math.round(3 + km * 0.1) * travelers, label: 'Train, bus or tour transfer' }
  }

  const lowWalking = mobility === 'low-walking'
  const walkLimit = lowWalking ? 0.6 : 1.6
  if (km <= walkLimit) {
    const speed = lowWalking ? 3.4 : 4.6
    return { mode: 'walk', minutes: Math.max(2, Math.ceil((km / speed) * 60)), km, cost: 0, label: 'Walk' }
  }

  const late = hour >= 23 || hour < 6
  const vehicles = Math.ceil(travelers / 4)
  const taxi = () => ({
    mode: 'taxi',
    minutes: Math.round(5 + (km / 24) * 60),
    km,
    cost: Math.round((dest.costs.taxiBase + dest.costs.taxiPerKm * km) * vehicles),
    label: 'Taxi or rideshare',
  })
  if (lowWalking || late || km > 11) return taxi()
  return {
    mode: 'transit',
    minutes: Math.round(9 + (km / 19) * 60),
    km,
    cost: Math.round(dest.costs.transitFare * travelers * 10) / 10,
    label: dest.transit,
  }
}

/** Airport ⇄ stay transfer: public option by default, taxi for low-walking. */
export function airportLeg(dest, stay, ctx) {
  const km = haversineKm(dest.airport.coords, stay.coords) * ROUTE_FACTOR
  const { travelers = 1, mobility = 'standard' } = ctx
  if (mobility === 'low-walking') {
    return {
      mode: 'taxi',
      minutes: Math.round(Math.max(20, dest.airportTransfer.minutes * 0.8)),
      km,
      cost: Math.round((dest.costs.taxiBase + dest.costs.taxiPerKm * km) * Math.ceil(travelers / 4)),
      label: 'Taxi (door to door)',
    }
  }
  return {
    mode: 'transit',
    minutes: dest.airportTransfer.minutes,
    km,
    cost: Math.round(dest.airportTransfer.cost * travelers),
    label: dest.airportTransfer.mode,
  }
}
