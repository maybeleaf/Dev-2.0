import { PACES } from '../data/categories.js'
import { centroid, haversineKm } from '../lib/geo.js'
import { createRng } from '../lib/random.js'
import { dateRange, epochToZoned } from '../lib/time.js'
import { getCatalog, isMealFiller, isWander } from './catalog.js'
import { optimizeDay } from './optimize.js'
import { dayWindow, scheduleDay } from './schedule.js'

let uidCounter = 0
export const itemUid = () => `it${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

/** Local dates the traveller is actually at the destination. */
export function tripDates(dest, outbound, inbound) {
  const first = epochToZoned(outbound.arrive, dest.timezone).date
  const last = epochToZoned(inbound.depart, dest.timezone).date
  return first <= last ? dateRange(first, last) : []
}

export function scorer(params, rng) {
  const interests = new Set(params.interests?.length ? params.interests : ['sightseeing', 'food'])
  const lowWalk = params.mobility === 'low-walking'
  return (a) => {
    let s = a.rating * 1.3 + rng.next() * 0.9
    if (interests.has(a.category)) s += 2.4
    if (a.category === 'sightseeing') s += 0.5
    if (a.tags.includes('iconic')) s += 0.9
    if (params.budgetLevel === 'tight') {
      if (a.cost === 0) s += 0.8
      if (a.cost > 25) s -= 1.2
    }
    if (lowWalk && a.tags.includes('step-free')) s += 1.2
    if (lowWalk && a.category === 'nature') s -= 0.5
    if (a.generated) s -= 2.5
    return s
  }
}

/** How much activity a given day should hold (minutes and item count). */
function dayTarget(pace, window, fullHours, jetLag) {
  if (window.hours < 1.25) return { minutes: 0, count: 0 }
  const frac = Math.min(1, window.hours / fullHours)
  return {
    minutes: Math.round(pace.activeMin * frac * (jetLag ? 0.6 : 1)),
    count: Math.max(1, Math.round(pace.maxMains * frac) - (jetLag ? 1 : 0)),
  }
}

/**
 * Builds itinerary days. `keep` maps date → items to preserve untouched
 * (used when flights change or a single day is regenerated).
 */
export function buildDays({ params, dest, stay, outbound, inbound, seed, keep = {}, avoid = [] }) {
  const ctx = { params, stay, outbound, inbound, catalog: getCatalog(dest) }
  const dates = tripDates(dest, outbound, inbound)
  const rng = createRng(`${seed}|days|${dates[0]}|${Object.keys(keep).join(',')}`)
  const interests = new Set(params.interests?.length ? params.interests : ['sightseeing', 'food'])
  const pace = PACES[params.pace] || PACES.balanced
  const fullHours = pace.end - pace.start
  const lowWalk = params.mobility === 'low-walking'
  const baseScore = scorer(params, rng)
  const avoidSet = new Set(avoid)
  const score = (a) => baseScore(a) - (avoidSet.has(a.id) ? 3 : 0)
  const windows = dates.map((_, i) => dayWindow(ctx, dest, i, dates))
  const jetLag = outbound.durationMin > 360

  const used = new Set()
  for (const items of Object.values(keep)) for (const it of items) used.add(it.ref)

  const allowNightlife = interests.has('nightlife') || params.pace === 'packed'
  const mains = dest.activities
    .filter((a) => a.category !== 'food' && !a.dayTrip && (a.category !== 'nightlife' || allowNightlife))
    .map((a) => ({ a, s: score(a) }))
    .sort((x, y) => y.s - x.s)
  const wanders = [...ctx.catalog.values()].filter(isWander)

  // Day trips take a whole day — only on longer trips, spread out.
  const toBuild = dates.map((d, i) => i).filter((i) => !keep[dates[i]])
  const fullDays = toBuild.filter((i) => windows[i].hours >= fullHours - 0.75)
  const dayTripPool = lowWalk
    ? []
    : dest.activities.filter((a) => a.dayTrip && !used.has(a.id)).map((a) => ({ a, s: score(a) })).sort((x, y) => y.s - x.s)
  const maxDayTrips = Math.min(dayTripPool.length, Math.floor(dates.length / 4), fullDays.length > 1 ? 2 : 0)
  const dayTripFor = new Map()
  for (let k = 0; k < maxDayTrips; k++) {
    const slot = fullDays[Math.min(fullDays.length - 1, Math.round(((k + 1) * fullDays.length) / (maxDayTrips + 1)))]
    if (slot === undefined || dayTripFor.has(slot)) continue
    const pick = dayTripPool.find((d) => !used.has(d.a.id) && !d.a.closedDays?.includes(windows[slot].dow))
    if (!pick) continue
    dayTripFor.set(slot, pick.a)
    used.add(pick.a.id)
  }

  const targets = dates.map((_, i) =>
    keep[dates[i]] || dayTripFor.has(i) ? { minutes: 0, count: 0 } : dayTarget(pace, windows[i], fullHours, i === 0 && jetLag),
  )

  // Greedy geographic grouping: each day grows around a seed activity
  // until it holds the pace's worth of activity time.
  const plans = dates.map(() => [])
  const fillOrder = toBuild.filter((i) => targets[i].count > 0).sort((a, b) => targets[b].minutes - targets[a].minutes || a - b)
  for (const i of fillOrder) {
    const w = windows[i]
    const avail = mains.filter((m) => !used.has(m.a.id) && !m.a.closedDays?.includes(w.dow))
    if (!avail.length) break
    const seedPick =
      i === 0
        ? avail.slice(0, 8).reduce((b, m) => (haversineKm(stay.coords, m.a.coords) < haversineKm(stay.coords, b.a.coords) ? m : b))
        : avail[0]
    const group = [seedPick]
    used.add(seedPick.a.id)
    let minutes = seedPick.a.duration
    while (group.length < targets[i].count && minutes < targets[i].minutes) {
      const c = centroid(group.map((g) => g.a.coords))
      let best = null
      let bestVal = Infinity
      for (const m of avail) {
        if (used.has(m.a.id)) continue
        const val = haversineKm(c, m.a.coords) * 0.9 - m.s * 0.55
        if (val < bestVal) {
          best = m
          bestVal = val
        }
      }
      if (!best) break
      group.push(best)
      used.add(best.a.id)
      minutes += best.a.duration
    }
    plans[i] = group.map((g) => g.a)
  }
  // Out of named sights on a long trip? Wander a neighbourhood instead.
  for (const i of fillOrder) {
    let minutes = plans[i].reduce((s, a) => s + a.duration, 0)
    while (plans[i].length < targets[i].count && minutes < targets[i].minutes * 0.7) {
      const wnd = wanders.find((x) => !used.has(x.id))
      if (!wnd) break
      plans[i].push(wnd)
      used.add(wnd.id)
      minutes += wnd.duration
    }
  }

  // Meals: chosen near where you'll be at that time of day. When the named
  // spots run out we use a "lunch in <area>" filler rather than repeat one.
  const foods = dest.activities.filter((a) => a.category === 'food')
  const fillers = [...ctx.catalog.values()].filter(isMealFiller)
  const usedFood = new Set([...used].filter((id) => ctx.catalog.get(id)?.category === 'food'))
  const pickMeal = (meal, anchor, dow, special) => {
    let pool = foods.filter((f) => f.meal === meal && !usedFood.has(f.id) && !f.closedDays?.includes(dow))
    if (!pool.length) pool = fillers.filter((f) => f.meal === meal && !usedFood.has(f.id))
    if (!pool.length) return null
    let best = null
    let bestVal = Infinity
    for (const f of pool) {
      let val = haversineKm(anchor, f.coords) * 0.8 - f.rating * 1.1 + rng.next() * 0.6
      if (params.budgetLevel === 'tight' && f.priceLevel >= 3) val += 2.5
      if (special && f.priceLevel >= 3) val -= 1.5
      if (params.budgetLevel === 'generous' && meal === 'dinner' && f.priceLevel === 1) val += 0.8
      if (interests.has('food') && f.tags.includes('local-favorite')) val -= 0.4
      if (lowWalk && f.tags.includes('step-free')) val -= 0.6
      if (avoidSet.has(f.id)) val += 3
      if (val < bestVal) {
        best = f
        bestVal = val
      }
    }
    usedFood.add(best.id)
    return best
  }

  toBuild.forEach((i) => {
    const w = windows[i]
    const items = plans[i].slice()
    const dt = dayTripFor.get(i)
    if (dt) items.unshift(dt)
    const add = (a) => a && items.push(a)
    const cityPts = items.filter((a) => !a.dayTrip).map((a) => a.coords)
    const anchor = cityPts.length ? centroid(cityPts) : stay.coords
    const evening = items.find((a) => a.bestTime === 'evening')?.coords ?? anchor
    const breakfastDay =
      params.pace === 'packed' || (params.pace === 'balanced' && i % 2 === 1) || (params.pace === 'relaxed' && i % 3 === 1)
    if (w.startH <= 9.75 && w.endH >= 11 && breakfastDay) add(pickMeal('breakfast', stay.coords, w.dow, false))
    if (!dt && w.startH <= 13 && w.endH >= 14.25) add(pickMeal('lunch', anchor, w.dow, false))
    if (w.startH <= 19.5 && w.endH >= 20.5) add(pickMeal('dinner', dt ? stay.coords : evening, w.dow, params.budgetLevel !== 'tight' && i % 3 === 2))
    if (!dt && params.pace !== 'relaxed' && i % 2 === 0 && w.startH <= 15 && w.endH >= 17.5) add(pickMeal('snack', anchor, w.dow, false))
    plans[i] = items
  })

  const days = dates.map((date, i) => ({
    date,
    items: keep[date] ? keep[date] : plans[i].map((a) => ({ uid: itemUid(), ref: a.id })),
  }))

  // Order every regenerated day, then trim overflow / top up idle time.
  for (const i of toBuild) {
    days[i].items = fitDay({ dest, ctx, dates, dayIndex: i, items: days[i].items, used, mains, score, target: targets[i] })
  }
  return days
}

/** Trims a day that runs late or hits closing times, then fills big idle gaps. */
export function fitDay({ dest, ctx, dates, dayIndex, items, used = new Set(), mains = null, score = null, target = null }) {
  const sched = (list) => scheduleDay({ dest, ctx, dates, dayIndex, items: list })
  const sort = (list) => optimizeDay({ dest, ctx, dates, dayIndex, items: list }).items
  // Lunch and dinner are the last things we'd ever drop; snacks go first.
  const value = (ref) => {
    const a = ctx.catalog.get(ref)
    if (!a) return -99
    if (a.category === 'food') return a.meal === 'snack' ? 0.5 : a.meal === 'breakfast' ? 2 : 40
    return (score ? score(a) : a.rating) + (a.dayTrip ? 5 : 0)
  }
  const pickDrop = (stops) => stops.reduce((a, b) => (value(b.item.ref) < value(a.item.ref) ? b : a))
  let list = sort(items)
  let s = sched(list)
  for (let guard = 0; guard < 8; guard++) {
    const unlocked = s.stops.filter((st) => !st.item.locked)
    const hard = unlocked.filter((st) => st.issues.some((x) => x.type === 'closes' || x.type === 'closed'))
    if (s.overrunMin <= 10 && !hard.length) break
    let drop
    if (hard.length) drop = pickDrop(hard)
    else {
      // Overrun: drop whatever spills past the end of the day, unless it's a real meal.
      const spill = unlocked.filter((st) => st.issues.some((x) => x.type === 'overrun') && value(st.item.ref) < 40)
      drop = spill.length ? pickDrop(spill) : unlocked.length ? pickDrop(unlocked) : null
    }
    if (!drop) break
    list = sort(list.filter((it) => it.uid !== drop.item.uid))
    s = sched(list)
  }

  const isDayTrip = list.some((it) => ctx.catalog.get(it.ref)?.dayTrip)
  if (mains && !isDayTrip) {
    const mainCount = () => list.filter((it) => ctx.catalog.get(it.ref)?.category !== 'food').length
    const mainMin = () => list.reduce((m, it) => {
      const a = ctx.catalog.get(it.ref)
      return a && a.category !== 'food' ? m + a.duration : m
    }, 0)
    const idle = (sc) => sc.freeEndMin + sc.stops.reduce((m, st) => m + (st.waitMin >= 20 ? st.waitMin : 0), 0)
    const maxCount = target ? target.count + 1 : 6
    const maxMin = target ? target.minutes * 1.2 : 400
    for (let k = 0; k < 3 && idle(s) >= 150 && mainCount() < maxCount && mainMin() < maxMin; k++) {
      const pts = list.map((it) => ctx.catalog.get(it.ref)?.coords).filter(Boolean)
      const c = pts.length ? centroid(pts) : ctx.stay.coords
      const w = s.window
      const cand = mains
        .filter((m) => !used.has(m.a.id) && !m.a.closedDays?.includes(w.dow))
        .map((m) => ({ m, d: haversineKm(c, m.a.coords) - (m.s - 6) * 0.3 }))
        .sort((x, y) => x.d - y.d)[0]
      if (!cand) break
      used.add(cand.m.a.id)
      const trial = sort([...list, { uid: itemUid(), ref: cand.m.a.id }])
      const ts = sched(trial)
      if (ts.overrunMin > 10 || ts.issueCount > s.issueCount) {
        used.delete(cand.m.a.id)
        break
      }
      list = trial
      s = ts
    }
  }
  return list
}
