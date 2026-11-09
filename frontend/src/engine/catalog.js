// Resolves itinerary item refs to activity records. Besides the hand-written
// activities, each neighbourhood becomes a free "wander" filler for long trips.

const cache = new WeakMap()

const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export function getCatalog(dest) {
  let map = cache.get(dest)
  if (map) return map
  map = new Map()
  for (const a of dest.activities) map.set(a.id, a)
  for (const n of dest.neighborhoods) {
    // Generic meal fallbacks so long trips don't repeat the same restaurants.
    for (const [meal, label, cost, hours, duration] of [
      ['lunch', 'Lunch break', dest.costs.mealCheap * 1.2, [11, 16], 60],
      ['dinner', 'Dinner out', dest.costs.mealMid, [18, 23], 90],
    ]) {
      const mid = `${dest.id}-${meal}-${slug(n.name)}`
      map.set(mid, {
        id: mid,
        name: `${label} in ${n.name}`,
        category: 'food',
        type: 'Your pick',
        area: n.name,
        coords: n.coords,
        duration,
        cost: Math.round(cost),
        rating: 4.3,
        hours,
        bestTime: meal === 'lunch' ? 'afternoon' : 'evening',
        description: `Wander ${n.name} and pick somewhere that smells good — budgeted at a typical local price.`,
        tags: ['local-favorite'],
        meal,
        cuisine: 'Local',
        priceLevel: meal === 'lunch' ? 1 : 2,
        generated: true,
        mealFiller: true,
      })
    }
    const id = `${dest.id}-wander-${slug(n.name)}`
    map.set(id, {
      id,
      name: `Wander around ${n.name}`,
      category: 'sightseeing',
      type: 'Neighbourhood stroll',
      area: n.name,
      coords: n.coords,
      duration: 90,
      cost: 0,
      rating: 4.4,
      hours: [8, 22],
      bestTime: 'any',
      description: n.blurb,
      tags: ['free', 'outdoor', 'local-favorite'],
      generated: true,
    })
  }
  cache.set(dest, map)
  return map
}

export const isWander = (activity) => Boolean(activity?.generated) && !activity.mealFiller
export const isMealFiller = (activity) => Boolean(activity?.mealFiller)
