import { ORIGIN_AIRPORTS } from './airports.js'

// Every file in ./destinations is picked up automatically — drop in a new
// destination file and it appears in Explore, search and the planner.
const modules = import.meta.glob('./destinations/*.js', { eager: true })

export const DESTINATIONS = Object.values(modules)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name))

export const DESTINATION_BY_ID = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]))

const destinationAirports = DESTINATIONS.map((d) => ({
  code: d.airport.code,
  city: d.name,
  country: d.country,
  name: d.airport.name,
  coords: d.airport.coords,
  timezone: d.timezone,
}))

// Starting-city list: curated origins first, then destination cities (deduped by code).
export const AIRPORTS = [...ORIGIN_AIRPORTS, ...destinationAirports]
  .filter((a, i, all) => all.findIndex((b) => b.code === a.code) === i)
  .sort((a, b) => a.city.localeCompare(b.city))

export const AIRPORT_BY_CODE = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]))
