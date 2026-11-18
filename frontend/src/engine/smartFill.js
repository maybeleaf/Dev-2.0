import { addDays, dowOf, todayStr } from '../lib/time.js'

// "Describe your trip" → form fields. A small rule-based parser: no network, no
// API key, and it explains exactly what it understood as chips.

const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14 }
const NUM_RE = '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)'
const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : NUM[s])

const MONTHS = [
  ['january', 'jan'], ['february', 'feb'], ['march', 'mar'], ['april', 'apr'], ['may'], ['june', 'jun'],
  ['july', 'jul'], ['august', 'aug'], ['september', 'sept', 'sep'], ['october', 'oct'], ['november', 'nov'], ['december', 'dec'],
]

export const DESTINATION_ALIASES = {
  'new-york': ['new york city', 'new york', 'nyc', 'manhattan', 'brooklyn', 'big apple'],
  'mexico-city': ['mexico city', 'cdmx', 'mexico'],
  'rio-de-janeiro': ['rio de janeiro', 'rio', 'brazil'],
  'cape-town': ['cape town', 'south africa'],
  tokyo: ['tokyo', 'japan'],
  bangkok: ['bangkok', 'thailand'],
  bali: ['bali', 'ubud', 'indonesia'],
  sydney: ['sydney', 'australia'],
  paris: ['paris', 'france'],
  reykjavik: ['reykjavik', 'iceland'],
  istanbul: ['istanbul', 'turkey', 'turkiye'],
  marrakech: ['marrakech', 'marrakesh', 'morocco'],
  lisbon: ['lisbon', 'lisboa', 'portugal'],
  banff: ['banff', 'rockies', 'rocky mountains'],
  miami: ['miami', 'florida', 'south beach'],
}

const INTEREST_WORDS = {
  food: ['food', 'foodie', 'eat', 'eating', 'restaurants', 'cuisine', 'street food', 'wine', 'tapas', 'brunch'],
  culture: ['museum', 'museums', 'art', 'history', 'historic', 'culture', 'cultural', 'galleries', 'architecture', 'temples'],
  shopping: ['shop', 'shopping', 'markets', 'boutiques', 'souvenirs', 'thrifting'],
  nature: ['nature', 'hike', 'hiking', 'outdoors', 'parks', 'trails', 'wildlife', 'waterfalls'],
  nightlife: ['nightlife', 'bars', 'party', 'partying', 'clubs', 'clubbing', 'cocktails', 'live music', 'dancing'],
  relax: ['relax', 'relaxing', 'spa', 'unwind', 'beach day', 'lounging'],
  sightseeing: ['sights', 'sightseeing', 'landmarks', 'photos', 'photography', 'iconic', 'views'],
}

const VIBE_WORDS = {
  warm: ['warm', 'sunny', 'hot', 'tropical', 'sunshine', 'sun'],
  beach: ['beach', 'beaches', 'ocean', 'coast', 'surf'],
  mountains: ['mountain', 'mountains', 'alps', 'peaks'],
  cold: ['snow', 'cold', 'winter', 'northern lights', 'ski'],
  city: ['city', 'urban', 'big city'],
  romantic: ['romantic', 'honeymoon', 'anniversary', 'date'],
  budget: ['cheap', 'budget', 'affordable', 'inexpensive', 'broke'],
  luxury: ['luxury', 'luxurious', 'fancy', 'splurge', 'treat'],
  offbeat: ['somewhere new', 'different', 'off the beaten path', 'unusual', 'new place', 'never been'],
  adventure: ['adventure', 'adventurous', 'thrill'],
  family: ['kids', 'family', 'children', 'toddler'],
  scenic: ['scenic', 'scenery', 'beautiful', 'change of scenery'],
}

const PACE_WORDS = {
  relaxed: ['relaxed', 'slow', 'chill', 'easy', 'laid-back', 'laid back', 'lazy', 'unwind'],
  packed: ['packed', 'busy', 'see everything', 'action-packed', 'jam-packed', 'as much as possible', 'nonstop'],
}

const MOBILITY_WORDS = ['wheelchair', 'accessible', 'mobility', 'less walking', 'limited walking', 'not much walking', 'stroller', 'pram', 'cane', 'walker', 'elderly', 'grandparents']

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasWord = (text, w) => new RegExp(`(^|[^a-z])${esc(w)}([^a-z]|$)`).test(text)

function upcomingFriday(today) {
  const dow = dowOf(today)
  return addDays(today, (5 - dow + 7) % 7 || 7)
}

export function parseTripText(input, { airports, destinations, today = todayStr(), defaultCurrency = 'USD' }) {
  let text = ` ${norm(input)} `
  const out = { chips: [], interests: [], vibes: [] }
  const chip = (key, emoji, label) => out.chips.push({ key, emoji, label })

  // — Origin: "from Toronto" / "from YYZ" —
  const fromMatch = text.match(/\bfrom\s+([a-z][a-z .'-]{1,40}?)(?=\s+(?:to|for|in|on|with|under|around|next|this|during|and|leaving|departing|at)\b|[,.!?]|\s*$)/)
  if (fromMatch) {
    const q = fromMatch[1].trim()
    const ap = airports.find((a) => norm(a.city) === q || a.code.toLowerCase() === q) || airports.find((a) => q.includes(norm(a.city)) || norm(a.city).startsWith(q))
    if (ap) {
      out.originCode = ap.code
      chip('origin', '🛫', `From ${ap.city}`)
      text = text.replace(fromMatch[0], ' ')
    }
  }

  // — Destination —
  let bestDest = null
  for (const d of destinations) {
    for (const alias of DESTINATION_ALIASES[d.id] || [norm(d.name)]) {
      const i = text.search(new RegExp(`(^|[^a-z])${esc(alias)}([^a-z]|$)`))
      if (i >= 0 && (!bestDest || alias.length > bestDest.alias.length)) bestDest = { d, alias, i }
    }
  }
  if (bestDest) {
    out.destinationId = bestDest.d.id
    chip('destination', '📍', bestDest.d.name)
  }

  // — Duration —
  let days = null
  const dayM = text.match(new RegExp(`${NUM_RE}[\\s-]*(day|days|night|nights)\\b`))
  const weekM = text.match(new RegExp(`${NUM_RE}[\\s-]*(week|weeks)\\b`))
  if (dayM) days = toNum(dayM[1]) + (dayM[2].startsWith('night') ? 1 : 0)
  else if (weekM) days = toNum(weekM[1]) * 7
  else if (/\bfortnight\b/.test(text)) days = 14
  else if (/\blong weekend\b/.test(text)) days = 4
  else if (/\bweekend\b/.test(text)) days = 3
  if (days) {
    out.days = Math.max(2, Math.min(21, days))
    chip('days', '🗓️', `${out.days} days`)
  }

  // — Dates —
  let start = null
  const iso = text.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/)
  const monthIdx = MONTHS.findIndex((names) => names.some((n) => (n === 'may' ? /\bin may\b|\bmay\s+\d/.test(text) : hasWord(text, n))))
  if (iso) start = `${iso[1]}-${iso[2]}-${iso[3]}`
  else if (/\btomorrow\b/.test(text)) start = addDays(today, 1)
  else if (/\bthis weekend\b/.test(text)) start = upcomingFriday(today)
  else if (/\bnext weekend\b/.test(text)) start = addDays(upcomingFriday(today), 7)
  else if (/\bnext week\b/.test(text)) start = addDays(today, 7)
  else if (/\bnext month\b/.test(text)) {
    const [y, m] = today.split('-').map(Number)
    start = `${m === 12 ? y + 1 : y}-${String((m % 12) + 1).padStart(2, '0')}-10`
  } else if (monthIdx >= 0) {
    const [y, m] = today.split('-').map(Number)
    const target = monthIdx + 1
    const dayNum = text.match(new RegExp(`(?:${MONTHS[monthIdx].map(esc).join('|')})\\s+(\\d{1,2})\\b`))
    const dd = dayNum ? String(Math.min(28, Number(dayNum[1]))).padStart(2, '0') : '10'
    const year = target > m || (target === m && Number(dd) > Number(today.slice(8))) ? y : y + 1
    start = target === m && !dayNum ? addDays(today, 14) : `${year}-${String(target).padStart(2, '0')}-${dd}`
  } else {
    const inWeeks = text.match(new RegExp(`\\bin\\s+${NUM_RE}\\s+weeks?\\b`))
    if (inWeeks) start = addDays(today, toNum(inWeeks[1]) * 7)
  }
  if (start && start >= today) {
    out.startDate = start
    chip('dates', '📅', `Starting ${start}`)
  }

  // — Budget —
  const money = [
    /[$€£]\s?(\d[\d,]*(?:\.\d+)?)\s?(k|grand)?\b/,
    /\b(\d[\d,]*(?:\.\d+)?)\s?(k|grand|thousand)\b/,
    /\b(\d[\d,]*(?:\.\d+)?)\s?(?:dollars|bucks|usd|cad|eur|euros?|pounds|gbp)\b/,
    /\b(?:budget|under|max|spend|below)\s+(?:of\s+|is\s+|around\s+)?(\d[\d,]*(?:\.\d+)?)\b/,
  ]
  for (const re of money) {
    const m = text.match(re)
    if (!m) continue
    let amount = Number(m[1].replace(/,/g, ''))
    if (m[2] && /k|grand|thousand/.test(m[2])) amount *= 1000
    if (amount < 100) continue
    const currency = /€|\beur|\beuro/.test(text) ? 'EUR' : /£|\bgbp|\bpound/.test(text) ? 'GBP' : /\bcad\b|canadian/.test(text) ? 'CAD' : /\busd\b|us dollars/.test(text) ? 'USD' : defaultCurrency
    out.budget = { amount, currency }
    chip('budget', '💰', `${currency} ${amount.toLocaleString()}`)
    break
  }

  // — Travellers —
  const group = text.match(new RegExp(`${NUM_RE}\\s+(people|persons|of us|friends|adults|travell?ers|guests)\\b`))
  const family = text.match(new RegExp(`family of\\s+${NUM_RE}\\b`))
  if (group) out.travelers = toNum(group[1])
  else if (family) out.travelers = toNum(family[1])
  else if (/\b(solo|alone|by myself|just me)\b/.test(text)) out.travelers = 1
  else if (/\b(couple|partner|girlfriend|boyfriend|wife|husband|honeymoon|anniversary|two of us|me and my)\b/.test(text)) out.travelers = 2
  if (out.travelers) {
    out.travelers = Math.max(1, Math.min(6, out.travelers))
    chip('travelers', '👥', `${out.travelers} traveller${out.travelers === 1 ? '' : 's'}`)
  }

  // — Interests, vibes, pace, mobility —
  for (const [key, words] of Object.entries(INTEREST_WORDS)) if (words.some((w) => hasWord(text, w))) out.interests.push(key)
  for (const [key, words] of Object.entries(VIBE_WORDS)) if (words.some((w) => hasWord(text, w))) out.vibes.push(key)
  if (out.vibes.includes('beach') && !out.interests.includes('relax')) out.interests.push('relax')
  for (const [key, words] of Object.entries(PACE_WORDS)) if (words.some((w) => hasWord(text, w))) out.pace = key
  if (MOBILITY_WORDS.some((w) => hasWord(text, w))) out.mobility = 'low-walking'

  const interestEmoji = { food: '🍜', culture: '🏛️', shopping: '🛍️', nature: '🌿', nightlife: '🌙', relax: '🧖', sightseeing: '📸' }
  for (const i of out.interests) chip(`i-${i}`, interestEmoji[i], i[0].toUpperCase() + i.slice(1))
  const vibeEmoji = { warm: '☀️', beach: '🏖️', mountains: '🏔️', cold: '❄️', city: '🏙️', romantic: '💞', budget: '💸', luxury: '💎', offbeat: '🧭', adventure: '🧗', family: '🧸', scenic: '🌄' }
  for (const v of out.vibes) chip(`v-${v}`, vibeEmoji[v], v === 'offbeat' ? 'Somewhere new' : v[0].toUpperCase() + v.slice(1))
  if (out.pace) chip('pace', out.pace === 'relaxed' ? '🐢' : '⚡', out.pace === 'relaxed' ? 'Relaxed pace' : 'Packed pace')
  if (out.mobility) chip('mobility', '♿', 'Less walking')
  return out
}
