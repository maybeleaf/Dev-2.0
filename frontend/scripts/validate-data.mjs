// Validates destination mock-data files against the Lift Off schema.
// Usage:  node scripts/validate-data.mjs            (all files in src/data/destinations)
//         node scripts/validate-data.mjs tokyo paris (just those ids)
import { readdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CATEGORY_KEYS, MEAL_KEYS, VIBE_KEYS, TAG_KEYS, REGIONS, POSTER_SCENES, BEST_TIMES,
} from '../src/data/categories.js'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '..', 'src', 'data', 'destinations')

const requested = process.argv.slice(2)
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.js') && f !== 'index.js')
  .filter((f) => requested.length === 0 || requested.includes(f.replace(/\.js$/, '')))

const HEX = /^#[0-9a-f]{6}$/i
const toRad = (d) => (d * Math.PI) / 180
function km([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

let totalErrors = 0
let totalWarnings = 0
const allIds = new Set()

for (const file of files) {
  const errors = []
  const warnings = []
  const err = (m) => errors.push(m)
  const warn = (m) => warnings.push(m)
  let d
  try {
    d = (await import(pathToFileURL(join(dir, file)).href)).default
  } catch (e) {
    console.error(`✗ ${file}: failed to import — ${e.message}`)
    totalErrors++
    continue
  }
  const isStr = (v) => typeof v === 'string' && v.trim().length > 0
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
  const isCoords = (c) => Array.isArray(c) && c.length === 2 && isNum(c[0]) && isNum(c[1]) && Math.abs(c[0]) <= 90 && Math.abs(c[1]) <= 180

  if (!d || typeof d !== 'object') { console.error(`✗ ${file}: no default export`); totalErrors++; continue }
  if (d.id + '.js' !== file) err(`id "${d.id}" must match file name`)
  if (!/^[a-z0-9-]+$/.test(d.id || '')) err('id must be lowercase kebab-case')
  for (const k of ['name', 'country', 'tagline', 'description', 'timezone', 'transit']) if (!isStr(d[k])) err(`${k} must be a non-empty string`)
  if (!/^[A-Z]{2}$/.test(d.countryCode || '')) err('countryCode must be ISO alpha-2, e.g. "PT"')
  if (!REGIONS.includes(d.region)) err(`region must be one of ${REGIONS.join(', ')}`)
  if (isStr(d.tagline) && d.tagline.length > 64) err(`tagline too long (${d.tagline.length} > 64)`)
  if (isStr(d.description) && d.description.length > 300) err(`description too long (${d.description.length} > 300)`)
  try { new Intl.DateTimeFormat('en-US', { timeZone: d.timezone }) } catch { err(`timezone "${d.timezone}" is not a valid IANA zone`) }
  if (!isCoords(d.coords)) err('coords must be [lat, lng]')

  // airport
  const ap = d.airport || {}
  if (!/^[A-Z]{3}$/.test(ap.code || '')) err('airport.code must be 3-letter IATA')
  if (!isStr(ap.name)) err('airport.name required')
  if (!isCoords(ap.coords)) err('airport.coords must be [lat, lng]')
  else if (isCoords(d.coords) && km(ap.coords, d.coords) > 160) err(`airport is ${km(ap.coords, d.coords).toFixed(0)} km from center (max 160)`)

  // currency
  const cur = d.currency || {}
  if (!/^[A-Z]{3}$/.test(cur.code || '')) err('currency.code must be ISO 4217')
  if (!isStr(cur.symbol)) err('currency.symbol required')
  if (!isNum(cur.perUSD) || cur.perUSD <= 0) err('currency.perUSD must be a positive number')

  if (!Array.isArray(d.languages) || d.languages.length === 0 || !d.languages.every(isStr)) err('languages must be a non-empty string array')

  // vibes & months
  if (!Array.isArray(d.vibes) || d.vibes.length < 4 || d.vibes.length > 8) err('vibes must have 4–8 entries')
  else for (const v of d.vibes) if (!VIBE_KEYS.includes(v)) err(`unknown vibe "${v}"`)
  if (!Array.isArray(d.bestMonths) || d.bestMonths.length < 2 || !d.bestMonths.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)) err('bestMonths must be 2+ integers 1–12')

  // climate
  if (!Array.isArray(d.climate) || d.climate.length !== 12) err('climate must have exactly 12 monthly entries')
  else d.climate.forEach((c, i) => {
    if (!isNum(c.high) || !isNum(c.low) || c.low > c.high) err(`climate[${i}] needs numeric high >= low`)
    if (!isNum(c.rain) || c.rain < 0 || c.rain > 31) err(`climate[${i}].rain must be rainy days 0–31`)
    if (!isNum(c.sun) || c.sun < 0 || c.sun > 16) err(`climate[${i}].sun must be sunshine hours/day 0–16`)
  })

  // costs
  const co = d.costs || {}
  for (const k of ['mealCheap', 'mealMid', 'mealHigh', 'coffee', 'transitFare', 'taxiBase', 'taxiPerKm']) if (!isNum(co[k]) || co[k] < 0) err(`costs.${k} must be a non-negative number`)
  if (isNum(co.mealCheap) && isNum(co.mealMid) && isNum(co.mealHigh) && !(co.mealCheap < co.mealMid && co.mealMid < co.mealHigh)) err('costs: mealCheap < mealMid < mealHigh')
  const st = co.stay || {}
  for (const k of ['budget', 'mid', 'luxury']) if (!isNum(st[k]) || st[k] <= 0) err(`costs.stay.${k} must be a positive number`)
  if (isNum(st.budget) && isNum(st.mid) && isNum(st.luxury) && !(st.budget < st.mid && st.mid < st.luxury)) err('costs.stay: budget < mid < luxury')

  const at = d.airportTransfer || {}
  if (!isStr(at.mode) || !isNum(at.minutes) || !isNum(at.cost)) err('airportTransfer needs { mode, minutes, cost }')

  const pr = d.practical || {}
  for (const k of ['plug', 'tipping', 'water', 'emergency']) if (!isStr(pr[k])) err(`practical.${k} required`)

  // poster
  const po = d.poster || {}
  if (!POSTER_SCENES.includes(po.scene)) err(`poster.scene must be one of ${POSTER_SCENES.join(', ')}`)
  if (!Array.isArray(po.palette) || po.palette.length !== 6 || !po.palette.every((c) => HEX.test(c))) err('poster.palette must be 6 hex colours')

  // neighborhoods
  if (!Array.isArray(d.neighborhoods) || d.neighborhoods.length < 4 || d.neighborhoods.length > 7) err('neighborhoods must have 4–7 entries')
  else d.neighborhoods.forEach((n, i) => {
    if (!isStr(n.name) || !isStr(n.blurb)) err(`neighborhoods[${i}] needs name + blurb`)
    if (!isCoords(n.coords)) err(`neighborhoods[${i}].coords invalid`)
    else if (isCoords(d.coords) && km(n.coords, d.coords) > 25) err(`neighborhood "${n.name}" is ${km(n.coords, d.coords).toFixed(1)} km from center (max 25)`)
  })

  // activities
  const acts = Array.isArray(d.activities) ? d.activities : []
  if (acts.length < 22) err(`need at least 22 activities (have ${acts.length})`)
  const counts = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]))
  const meals = Object.fromEntries(MEAL_KEYS.map((k) => [k, 0]))
  const seen = new Set()
  acts.forEach((a, i) => {
    const where = `activities[${i}] (${a?.name ?? '?'})`
    if (!/^[a-z0-9-]+$/.test(a.id || '')) err(`${where}: id must be kebab-case`)
    if (seen.has(a.id) || allIds.has(a.id)) err(`${where}: duplicate id "${a.id}"`)
    seen.add(a.id); allIds.add(a.id)
    if (!isStr(a.name)) err(`${where}: name required`)
    if (!CATEGORY_KEYS.includes(a.category)) err(`${where}: bad category "${a.category}"`)
    else counts[a.category]++
    if (!isStr(a.type)) err(`${where}: type required`)
    if (!isStr(a.area)) err(`${where}: area required`)
    if (!isCoords(a.coords)) err(`${where}: coords invalid`)
    else if (isCoords(d.coords)) {
      const dist = km(a.coords, d.coords)
      if (!a.dayTrip && dist > 25) err(`${where}: ${dist.toFixed(1)} km from center — mark dayTrip: true or move it (max 25 km)`)
      if (a.dayTrip && dist > 220) err(`${where}: day trip ${dist.toFixed(0)} km away (max 220)`)
    }
    if (!Number.isInteger(a.duration) || a.duration < 20 || a.duration > 720) err(`${where}: duration must be integer minutes 20–720`)
    if (a.dayTrip && a.duration < 240) err(`${where}: day trips should be >= 240 minutes`)
    if (!isNum(a.cost) || a.cost < 0 || a.cost > 400) err(`${where}: cost must be USD 0–400`)
    if (!isNum(a.rating) || a.rating < 3.5 || a.rating > 5) err(`${where}: rating must be 3.5–5`)
    if (!Array.isArray(a.hours) || a.hours.length !== 2 || !isNum(a.hours[0]) || !isNum(a.hours[1]) || a.hours[0] < 0 || a.hours[1] > 30 || a.hours[0] >= a.hours[1]) err(`${where}: hours must be [open, close] with 0 <= open < close <= 30`)
    else if ((a.hours[1] - a.hours[0]) * 60 < Math.min(a.duration, 600)) err(`${where}: opening window shorter than duration`)
    if (a.closedDays !== undefined && (!Array.isArray(a.closedDays) || !a.closedDays.every((x) => Number.isInteger(x) && x >= 0 && x <= 6) || a.closedDays.length > 3)) err(`${where}: closedDays must be up to 3 integers 0(Sun)–6(Sat)`)
    if (!BEST_TIMES.includes(a.bestTime)) err(`${where}: bestTime must be one of ${BEST_TIMES.join(', ')}`)
    if (!isStr(a.description)) err(`${where}: description required`)
    else if (a.description.length > 160) err(`${where}: description too long (${a.description.length} > 160)`)
    if (!Array.isArray(a.tags) || !a.tags.every((t) => TAG_KEYS.includes(t))) err(`${where}: tags must be from: ${TAG_KEYS.join(', ')}`)
    if (Array.isArray(a.tags) && a.tags.includes('free') && a.cost !== 0) err(`${where}: tagged free but cost is ${a.cost}`)
    if (a.category === 'food') {
      if (!MEAL_KEYS.includes(a.meal)) err(`${where}: food needs meal (${MEAL_KEYS.join('/')})`)
      else meals[a.meal]++
      if (!isStr(a.cuisine)) err(`${where}: food needs cuisine`)
    } else if (a.meal !== undefined) err(`${where}: only food items may have meal`)
    if (a.category === 'food' || a.category === 'shopping') {
      if (![1, 2, 3, 4].includes(a.priceLevel)) err(`${where}: ${a.category} needs priceLevel 1–4`)
    }
  })
  const minCounts = { sightseeing: 5, culture: 3, food: 9, shopping: 2, nature: 2, nightlife: 2, relax: 1 }
  for (const [k, min] of Object.entries(minCounts)) if (counts[k] < min) err(`need at least ${min} ${k} activities (have ${counts[k]})`)
  const minMeals = { breakfast: 2, lunch: 3, dinner: 3 }
  for (const [k, min] of Object.entries(minMeals)) if (meals[k] < min) err(`need at least ${min} ${k} spots (have ${meals[k]})`)
  if (acts.filter((a) => a.tags?.includes('free')).length < 2) warn('fewer than 2 free activities')
  if (acts.filter((a) => a.tags?.includes('rainy-day') || a.tags?.includes('indoor')).length < 3) warn('fewer than 3 indoor/rainy-day options')

  totalErrors += errors.length
  totalWarnings += warnings.length
  if (errors.length === 0) {
    console.log(`✓ ${file} — ${acts.length} activities (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')})`)
  } else {
    console.log(`✗ ${file} — ${errors.length} error(s):`)
    for (const e of errors) console.log(`    • ${e}`)
  }
  for (const w of warnings) console.log(`    ⚠ ${w}`)
}

console.log(`\n${files.length} file(s), ${totalErrors} error(s), ${totalWarnings} warning(s)`)
process.exit(totalErrors > 0 ? 1 : 0)
