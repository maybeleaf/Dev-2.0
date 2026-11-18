import { haversineKm } from '../lib/geo.js'
import { createRng } from '../lib/random.js'

// Mock "bnb" listings. Structured like a real listings API response so a
// provider can replace generateStays() later without touching the UI.

const TYPES = {
  apartment: { label: 'Entire apartment', factor: 1, cap: [2, 4], entire: true },
  loft: { label: 'Entire loft', factor: 1.18, cap: [2, 3], entire: true },
  studio: { label: 'Entire studio', factor: 0.82, cap: [1, 2], entire: true },
  room: { label: 'Private room', factor: 0.56, cap: [1, 2], entire: false },
  boutique: { label: 'Boutique hotel', factor: 1.32, cap: [2, 2], entire: false, hotel: true },
  guesthouse: { label: 'Guesthouse room', factor: 0.74, cap: [2, 3], entire: false, hotel: true },
  house: { label: 'Entire house', factor: 1.75, cap: [4, 6], entire: true },
  villa: { label: 'Private villa', factor: 1.6, cap: [2, 6], entire: true },
  bungalow: { label: 'Garden bungalow', factor: 0.9, cap: [2, 3], entire: true },
  cabin: { label: 'Entire cabin', factor: 1.3, cap: [2, 5], entire: true },
  chalet: { label: 'Mountain chalet', factor: 1.7, cap: [4, 6], entire: true },
  lodge: { label: 'Lodge room', factor: 1.05, cap: [2, 3], entire: false, hotel: true },
  riad: { label: 'Riad suite', factor: 1.1, cap: [2, 3], entire: false, hotel: true },
  riadWhole: { label: 'Entire riad', factor: 2.1, cap: [4, 8], entire: true },
  ryokan: { label: 'Ryokan-style room', factor: 1.25, cap: [2, 3], entire: false, hotel: true },
}

const SCENE_TYPES = {
  tropical: ['villa', 'bungalow', 'guesthouse', 'boutique', 'room', 'villa', 'apartment'],
  mountains: ['cabin', 'chalet', 'lodge', 'apartment', 'guesthouse', 'studio', 'cabin'],
  desert: ['riad', 'riadWhole', 'guesthouse', 'apartment', 'boutique', 'riad', 'room'],
  temple: ['apartment', 'ryokan', 'boutique', 'room', 'studio', 'guesthouse', 'apartment'],
  default: ['apartment', 'loft', 'room', 'boutique', 'studio', 'house', 'apartment', 'guesthouse'],
}

const ADJECTIVES = ['Sunlit', 'Airy', 'Quiet', 'Restored', 'Minimalist', 'Artsy', 'Leafy', 'Cosy', 'Light-filled', 'Elegant', 'Bright', 'Calm', 'Colourful', 'Hand-tiled']
const FEATURES = {
  default: ['with balcony', 'with rooftop terrace', 'near the old town', 'with city views', 'steps from transit', 'by the park', 'with a reading nook', 'above a bakery'],
  tropical: ['with plunge pool', 'with hammock', 'among the rice fields', 'with jungle views', 'with outdoor shower', 'with yoga deck'],
  mountains: ['with fireplace', 'with mountain views', 'with hot tub', 'by the river trail', 'with wood stove', 'with ski storage'],
  desert: ['with courtyard fountain', 'with roof terrace', 'with plunge pool', 'near the souks', 'with hammam', 'with mint-tea garden'],
  temple: ['near the station', 'with tatami lounge', 'with skyline view', 'on a quiet lane', 'with soaking tub', 'near the temple'],
}
const HOSTS = ['Ana', 'Malik', 'Sofia', 'Kenji', 'Amara', 'Lucas', 'Priya', 'Mateo', 'Yara', 'Noah', 'Leila', 'Tomás', 'Hana', 'Omar', 'Chloé', 'Arjun', 'Zara', 'Diego', 'Ines', 'Kwame', 'Mei', 'Rafael', 'Aisha', 'Finn']
const TIER_SPLIT = ['budget', 'budget', 'budget', 'mid', 'mid', 'mid', 'mid', 'mid', 'luxury', 'luxury', 'luxury', 'mid', 'budget']

function amenitiesFor(type, tier, dest, rng) {
  const t = TYPES[type]
  const warm = dest.vibes.includes('warm')
  const set = new Set(['wifi'])
  if (t.entire) set.add('kitchen')
  if (t.hotel || type === 'riad') set.add('breakfast')
  if (warm) set.add('ac')
  else set.add('heating')
  if (rng.chance(0.55)) set.add('washer')
  if (rng.chance(0.5)) set.add('workspace')
  if (rng.chance(0.35)) set.add('balcony')
  if ((tier === 'luxury' && warm) || type === 'villa' || (type === 'riadWhole' && rng.chance(0.6))) set.add('pool')
  if (tier === 'luxury' && t.hotel && rng.chance(0.6)) set.add('gym')
  if (dest.poster.scene === 'mountains' || rng.chance(0.15)) set.add('parking')
  if (rng.chance(t.hotel ? 0.6 : 0.3)) set.add('step-free')
  return [...set]
}

export function generateStays(dest, { seed, nights }) {
  const rng = createRng(`${seed}|stays|${dest.id}`)
  const typeList = SCENE_TYPES[dest.poster.scene] || SCENE_TYPES.default
  const features = FEATURES[dest.poster.scene] || FEATURES.default
  const tiers = rng.shuffle(TIER_SPLIT)
  const listings = []
  const usedTitles = new Set()

  tiers.forEach((tier, i) => {
    const hood = dest.neighborhoods[i % dest.neighborhoods.length]
    const typeKey = typeList[(i + rng.int(0, typeList.length - 1)) % typeList.length]
    const type = TYPES[typeKey]
    const capacity = rng.int(type.cap[0], type.cap[1])
    const base = dest.costs.stay[tier]
    const nightly = Math.round(base * type.factor * rng.range(0.86, 1.18) * (1 + Math.max(0, capacity - 2) * 0.16))
    let title
    for (let tries = 0; tries < 6; tries++) {
      title = `${rng.pick(ADJECTIVES)} ${type.label.replace(/^Entire /, '').toLowerCase()} ${rng.pick(features)}`
      if (!usedTitles.has(title)) break
    }
    usedTitles.add(title)
    const coords = [hood.coords[0] + rng.range(-0.004, 0.004), hood.coords[1] + rng.range(-0.005, 0.005)]
    const rating = Math.round(rng.range(tier === 'budget' ? 4.35 : 4.55, 4.98) * 100) / 100
    listings.push({
      id: `stay-${i}`,
      title: title[0].toUpperCase() + title.slice(1),
      type: type.label,
      typeKey,
      entire: type.entire,
      tier,
      neighborhood: hood.name,
      neighborhoodBlurb: hood.blurb,
      coords,
      distanceKm: Math.round(haversineKm(coords, dest.coords) * 10) / 10,
      pricePerNight: nightly,
      cleaningFee: type.entire ? Math.round(nightly * rng.range(0.25, 0.5)) : 0,
      capacity,
      bedrooms: Math.max(1, Math.ceil(capacity / 2) - (type.entire ? 0 : 1)),
      rating,
      reviews: rng.int(tier === 'luxury' ? 18 : 40, 860),
      superhost: rng.chance(0.42),
      freeCancellation: rng.chance(0.6),
      host: rng.pick(HOSTS),
      amenities: amenitiesFor(typeKey, tier, dest, rng),
      checkIn: 15,
      checkOut: 11,
      seed: `${seed}|${i}`,
    })
  })
  return listings.map((l) => ({ ...l, total: stayTotal(l, nights) }))
}

const HOTELISH = new Set(['boutique', 'guesthouse', 'lodge', 'riad', 'ryokan'])

/** The stay filter's three kinds: a whole home, a hotel-style room or a room in someone's place. */
export const stayKind = (s) => (s.entire ? 'entire' : HOTELISH.has(s.typeKey) ? 'hotel' : 'room')

export function stayTotal(stay, nights) {
  return stay.pricePerNight * Math.max(1, nights) + stay.cleaningFee
}
