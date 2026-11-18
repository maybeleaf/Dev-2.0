import { haversineKm } from '../lib/geo.js'
import { estimateTripCost } from './planTrip.js'

const FLIGHT_KMH = 800

export const flightHours = (origin, dest) => (origin ? haversineKm(origin.coords, dest.airport.coords) / FLIGHT_KMH + 0.6 : null)

/**
 * Scores destinations for "Surprise me", quick ideas and Explore's "Best match".
 * Considers vibes, interests, season, budget fit and flight time.
 */
export function rankDestinations(dests, { vibes = [], interests = [], budgetUSD, days = 5, travelers = 2, origin, month, maxFlightHours } = {}) {
  return dests
    .map((d) => {
      let score = 0
      const reasons = []
      for (const v of vibes) {
        if (d.vibes.includes(v)) {
          score += 3
          reasons.push(v)
        }
      }
      for (const i of interests) score += Math.min(1.5, d.activities.filter((a) => a.category === i).length / 5)
      if (month) {
        if (d.bestMonths.includes(month)) {
          score += 2
          reasons.push('season')
        }
        const c = d.climate[month - 1]
        if (vibes.includes('warm')) score += c.high >= 25 ? 2.5 : c.high >= 21 ? 1 : -3
        if (vibes.includes('cold')) score += c.high <= 8 ? 2 : -1
      }
      const hours = flightHours(origin, d)
      if (origin && hours !== null) {
        if (haversineKm(origin.coords, d.airport.coords) < 250) score -= 50
        if (maxFlightHours && hours > maxFlightHours) score -= 6
        score -= Math.max(0, hours - 9) * 0.25
      }
      const estimate = estimateTripCost(d, origin, { days, travelers })
      if (budgetUSD) {
        const r = budgetUSD / estimate
        score += r >= 1 ? 1.5 : r >= 0.85 ? 0 : -6 * (1 - r)
        if (r >= 1) reasons.push('budget')
      }
      return { dest: d, score, estimate, flightHours: hours, reasons }
    })
    .sort((a, b) => b.score - a.score)
}
