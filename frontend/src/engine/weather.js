import { createRng } from '../lib/random.js'
import { monthOf } from '../lib/time.js'

/** Estimated weather for a date from the destination's monthly climate normals. */
export function typicalDay(dest, date) {
  const rng = createRng(`${dest.id}|wx|${date}`)
  const c = dest.climate[monthOf(date) - 1]
  const high = Math.round(c.high + rng.range(-2.5, 2.5))
  const low = Math.round(Math.min(high - 2, c.low + rng.range(-2, 2)))
  const rainP = Math.min(0.9, c.rain / 30)
  let condition
  if (rng.next() < rainP * 0.85) condition = high <= 1 ? 'snow' : high > 24 && rng.chance(0.25) ? 'storm' : 'rain'
  else if (c.sun >= 9) condition = rng.chance(0.78) ? 'sunny' : 'partly'
  else if (c.sun >= 6) condition = rng.chance(0.5) ? 'sunny' : 'partly'
  else condition = rng.chance(0.5) ? 'partly' : 'cloudy'
  return { date, high, low, condition, rainChance: Math.round(rainP * 100), source: 'typical' }
}

/** Turns one day of Open-Meteo archive data into our weather shape. */
export function fromOpenMeteo(date, { max, min, precip, sunshineSec }) {
  const sunH = (sunshineSec ?? 0) / 3600
  let condition
  if (precip >= 6) condition = max <= 1 ? 'snow' : 'rain'
  else if (precip >= 1.5) condition = max <= 1 ? 'snow' : sunH < 4 ? 'rain' : 'partly'
  else if (sunH >= 8) condition = 'sunny'
  else if (sunH >= 4) condition = 'partly'
  else condition = 'cloudy'
  return {
    date,
    high: Math.round(max),
    low: Math.round(min),
    condition,
    rainChance: precip >= 1.5 ? 70 : precip > 0.2 ? 35 : 10,
    precip: Math.round(precip * 10) / 10,
    source: 'open-meteo',
  }
}
