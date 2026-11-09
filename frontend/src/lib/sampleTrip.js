import { AIRPORTS, AIRPORT_BY_CODE, DESTINATIONS, DESTINATION_BY_ID } from '../data/index.js'
import { estimateTripCost } from '../engine/planTrip.js'
import { addDays } from './time.js'

/**
 * The ready-made trip behind "Try a sample trip" and "Try the live demo":
 * six days in Lisbon for two (or the first other city if you live in Lisbon).
 * The live demo starts tomorrow so the dashboard has a real countdown.
 */
export function sampleTrip({ origin, homeAirport, today, currency = 'USD', live = false }) {
  const o = origin || AIRPORT_BY_CODE[homeAirport] || AIRPORTS[0]
  const d = DESTINATION_BY_ID.lisbon && o.code !== DESTINATION_BY_ID.lisbon.airport.code ? DESTINATION_BY_ID.lisbon : DESTINATIONS.find((x) => x.airport.code !== o.code)
  const startDate = addDays(today, live ? 1 : 14)
  const endDate = addDays(startDate, 5)
  const estimate = estimateTripCost(d, o, { days: 6, travelers: 2 }) * 1.1
  return {
    dest: d,
    origin: o,
    params: {
      startDate,
      endDate,
      travelers: 2,
      budgetUSD: Math.round(estimate / 50) * 50,
      currency,
      interests: ['sightseeing', 'food', 'culture'],
      pace: 'balanced',
      mobility: 'standard',
    },
  }
}
