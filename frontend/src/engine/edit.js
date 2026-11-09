import { haversineKm } from '../lib/geo.js'
import { getCatalog } from './catalog.js'
import { buildDays, fitDay, itemUid, tripDates } from './itinerary.js'
import { optimizeDay } from './optimize.js'
import { tripContext } from './schedule.js'

// Immutable trip edits. Every function returns a new trip object.

const touch = (trip, patch) => ({ ...trip, ...patch, updatedAt: Date.now() })

export function updateDayItems(trip, dayIndex, fn) {
  return touch(trip, { days: trip.days.map((d, i) => (i === dayIndex ? { ...d, items: fn(d.items) } : d)) })
}

export const removeItem = (trip, dayIndex, uid) => updateDayItems(trip, dayIndex, (items) => items.filter((it) => it.uid !== uid))

export const replaceItem = (trip, dayIndex, uid, ref) =>
  updateDayItems(trip, dayIndex, (items) => items.map((it) => (it.uid === uid ? { ...it, ref } : it)))

export const toggleLock = (trip, dayIndex, uid) =>
  updateDayItems(trip, dayIndex, (items) => items.map((it) => (it.uid === uid ? { ...it, locked: !it.locked } : it)))

export function moveItem(trip, dayIndex, uid, delta) {
  return updateDayItems(trip, dayIndex, (items) => {
    const i = items.findIndex((it) => it.uid === uid)
    const j = i + delta
    if (i < 0 || j < 0 || j >= items.length) return items
    const out = items.slice()
    ;[out[i], out[j]] = [out[j], out[i]]
    return out
  })
}

export function reorderItem(trip, dayIndex, uid, toIndex) {
  return updateDayItems(trip, dayIndex, (items) => {
    const from = items.findIndex((it) => it.uid === uid)
    if (from < 0) return items
    const out = items.slice()
    const [x] = out.splice(from, 1)
    out.splice(Math.max(0, Math.min(out.length, toIndex)), 0, x)
    return out
  })
}

export function moveItemToDay(trip, fromDay, uid, toDay) {
  const item = trip.days[fromDay]?.items.find((it) => it.uid === uid)
  if (!item || fromDay === toDay) return trip
  return touch(trip, {
    days: trip.days.map((d, i) => {
      if (i === fromDay) return { ...d, items: d.items.filter((it) => it.uid !== uid) }
      if (i === toDay) return { ...d, items: [...d.items, { ...item, locked: false }] }
      return d
    }),
  })
}

export function addItem(trip, dest, dayIndex, ref, { sort = true } = {}) {
  let next = updateDayItems(trip, dayIndex, (items) => [...items, { uid: itemUid(), ref }])
  if (sort) next = smartSortDay(next, dest, dayIndex).trip
  return next
}

export function usedRefs(trip) {
  const s = new Set()
  for (const d of trip.days) for (const it of d.items) s.add(it.ref)
  return s
}

export function smartSortDay(trip, dest, dayIndex) {
  const ctx = tripContext(trip, dest)
  const dates = trip.days.map((d) => d.date)
  const result = optimizeDay({ dest, ctx, dates, dayIndex, items: trip.days[dayIndex].items })
  return { trip: result.changed ? updateDayItems(trip, dayIndex, () => result.items) : trip, result }
}

export function smartSortAll(trip, dest) {
  let next = trip
  let before = 0
  let after = 0
  let changedDays = 0
  trip.days.forEach((_, i) => {
    const { trip: t, result } = smartSortDay(next, dest, i)
    next = t
    before += result.travelBefore
    after += result.travelAfter
    if (result.changed) changedDays++
  })
  return { trip: next, travelBefore: before, travelAfter: after, changedDays }
}

/** Similar options for swapping an item: same category / meal, unused, nearby. */
export function alternativesFor(trip, dest, dayIndex, uid, limit = 6) {
  const catalog = getCatalog(dest)
  const item = trip.days[dayIndex]?.items.find((it) => it.uid === uid)
  const current = item && catalog.get(item.ref)
  if (!current) return []
  const used = usedRefs(trip)
  return dest.activities
    .filter((a) => !used.has(a.id) && a.category === current.category && (a.category !== 'food' || a.meal === current.meal) && Boolean(a.dayTrip) === Boolean(current.dayTrip))
    .map((a) => ({ a, d: haversineKm(a.coords, current.coords) }))
    .sort((x, y) => x.d * 0.8 - x.a.rating - (y.d * 0.8 - y.a.rating))
    .slice(0, limit)
    .map(({ a, d }) => ({ ...a, distanceFromCurrent: d }))
}

/** Re-derives the day list after the selected flights change, keeping edits. */
export function reconcileDays(trip, dest) {
  const ctx = tripContext(trip, dest)
  const dates = tripDates(dest, ctx.outbound, ctx.inbound)
  const existing = Object.fromEntries(trip.days.map((d) => [d.date, d.items]))
  const keep = {}
  for (const date of dates) if (existing[date]) keep[date] = existing[date]
  const days = buildDays({ params: trip.params, dest, stay: ctx.stay, outbound: ctx.outbound, inbound: ctx.inbound, seed: trip.params.seed, keep })
  let next = touch(trip, { days })
  // First and last day windows depend on flight times — re-fit them.
  const nctx = tripContext(next, dest)
  const ndates = next.days.map((d) => d.date)
  for (const i of new Set([0, ndates.length - 1])) {
    if (i < 0 || !keep[ndates[i]]) continue
    const items = fitDay({ dest, ctx: nctx, dates: ndates, dayIndex: i, items: next.days[i].items })
    next = updateDayItems(next, i, () => items)
  }
  return next
}

export function selectFlight(trip, dest, direction, flightId) {
  const key = direction === 'outbound' ? 'outbound' : 'inbound'
  if (trip.selected[key] === flightId) return trip
  return reconcileDays(touch(trip, { selected: { ...trip.selected, [key]: flightId } }), dest)
}

export function selectStay(trip, stayId) {
  return touch(trip, { selected: { ...trip.selected, stay: stayId } })
}

export function regenerateDay(trip, dest, dayIndex) {
  const ctx = tripContext(trip, dest)
  const keep = {}
  trip.days.forEach((d, i) => {
    if (i !== dayIndex) keep[d.date] = d.items
  })
  const seed = `${trip.params.seed}|regen|${dayIndex}|${Date.now()}`
  const avoid = trip.days[dayIndex].items.map((it) => it.ref)
  const days = buildDays({ params: trip.params, dest, stay: ctx.stay, outbound: ctx.outbound, inbound: ctx.inbound, seed, keep, avoid })
  return touch(trip, { days })
}

export function setChecklist(trip, key, value) {
  return touch(trip, { checklist: { ...trip.checklist, [key]: value } })
}
