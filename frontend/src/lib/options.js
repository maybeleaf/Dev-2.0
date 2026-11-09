import { ORIGIN_AIRPORTS } from '../data/airports.js'
import { AIRPORTS } from '../data/index.js'

/** 🇵🇹 from "PT". */
export const flagOf = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '📍')

let cached = null
/** Options for the "leaving from" combobox: curated home airports + every destination airport. */
export function airportOptions() {
  if (cached) return cached
  const curated = new Set(ORIGIN_AIRPORTS.map((a) => a.code))
  cached = AIRPORTS.map((a) => ({
    value: a.code,
    label: `${a.city} (${a.code})`,
    sublabel: `${a.name} · ${a.country}`,
    keywords: curated.has(a.code) ? '' : 'destination',
    badge: a.code,
  }))
  return cached
}
