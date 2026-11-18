import { haversineKm } from '../lib/geo.js'
import { getCatalog } from './catalog.js'
import { replaceItem, selectFlight, selectStay, usedRefs } from './edit.js'
import { flightInconvenience } from './flights.js'
import { scheduleTrip, tripContext } from './schedule.js'
import { stayTotal } from './stays.js'

export const BUDGET_LINES = {
  flights: { label: 'Flights', emoji: '✈️' },
  stay: { label: 'Stay', emoji: '🛏️' },
  food: { label: 'Food', emoji: '🍽️' },
  activities: { label: 'Activities', emoji: '🎟️' },
  transport: { label: 'Getting around', emoji: '🚇' },
  extras: { label: 'Coffee & extras', emoji: '☕' },
}

export function computeBudget(trip, dest, schedules = scheduleTrip(trip, dest)) {
  const ctx = tripContext(trip, dest)
  const { travelers, budgetUSD } = trip.params
  const nights = Math.max(1, trip.days.length - 1)
  const flights = (ctx.outbound.price + ctx.inbound.price) * travelers
  const stay = stayTotal(ctx.stay, nights)
  const stayBreakfast = ctx.stay.amenities.includes('breakfast')
  let food = 0
  let activities = 0
  let transport = 0
  let extras = 0
  const byDay = schedules.map((s) => {
    let f = 0
    let a = 0
    let tr = 0
    let hasBreakfast = false
    for (const e of s.entries) {
      if (e.kind === 'stop') {
        if (e.act.category === 'food') {
          f += e.cost
          if (e.act.meal === 'breakfast') hasBreakfast = true
        } else a += e.cost
      } else if (e.kind === 'leg') tr += e.cost
    }
    let x = dest.costs.coffee * 2 * travelers
    if (!hasBreakfast && !stayBreakfast && s.window.startH < 11) x += dest.costs.mealCheap * 0.5 * travelers
    x = Math.round(x)
    food += f
    activities += a
    transport += tr
    extras += x
    return { date: s.date, food: f, activities: a, transport: tr, extras: x, total: f + a + tr + x }
  })
  const amounts = { flights, stay, food, activities, transport: Math.round(transport), extras }
  const total = Object.values(amounts).reduce((s, v) => s + v, 0)
  const lines = Object.entries(amounts).map(([key, amount]) => ({ key, amount, ...BUDGET_LINES[key] }))
  return {
    lines,
    amounts,
    total,
    budget: budgetUSD,
    remaining: budgetUSD - total,
    perPerson: total / travelers,
    perDay: total / Math.max(1, trip.days.length),
    byDay,
    nights,
    usedPct: budgetUSD > 0 ? total / budgetUSD : 1,
    status: total > budgetUSD ? 'over' : total > budgetUSD * 0.92 ? 'close' : 'under',
  }
}

/** Cheapest-first list of possible savings, each with an apply() function. */
function savingOptions(trip, dest) {
  const ctx = tripContext(trip, dest)
  const { travelers } = trip.params
  const options = []
  for (const [dir, list, sel] of [
    ['outbound', trip.flights.outbound, ctx.outbound],
    ['inbound', trip.flights.inbound, ctx.inbound],
  ]) {
    for (const f of list) {
      const saving = (sel.price - f.price) * travelers
      if (saving <= 0) continue
      const loss =
        Math.max(0, (f.durationMin - sel.durationMin) / 120) + Math.max(0, f.stops - sel.stops) * 0.6 +
        Math.max(0, flightInconvenience(f) - flightInconvenience(sel)) * 1.5
      options.push({
        kind: 'flight',
        saving,
        loss,
        label: `Switched to the ${f.airline.name} ${dir === 'outbound' ? 'outbound' : 'return'} flight (${f.flightNo})`,
        apply: (t) => selectFlight(t, dest, dir, f.id),
      })
    }
  }
  const nights = Math.max(1, trip.days.length - 1)
  const curStay = stayTotal(ctx.stay, nights)
  for (const s of trip.stays) {
    if (s.capacity < travelers || s.rating < 4.4) continue
    const saving = curStay - stayTotal(s, nights)
    if (saving <= 0) continue
    options.push({
      kind: 'stay',
      saving,
      loss: Math.max(0, (ctx.stay.rating - s.rating) * 3) + Math.max(0, s.distanceKm - ctx.stay.distanceKm) * 0.08 + 0.4,
      label: `Moved to “${s.title}” in ${s.neighborhood}`,
      apply: (t) => selectStay(t, s.id),
    })
  }
  const catalog = getCatalog(dest)
  const used = usedRefs(trip)
  trip.days.forEach((day, di) => {
    const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay()
    for (const it of day.items) {
      if (it.locked) continue
      const a = catalog.get(it.ref)
      if (!a || a.cost <= 0 || a.dayTrip) continue
      const pool = dest.activities.filter(
        (b) => !used.has(b.id) && !b.dayTrip && b.cost < a.cost && !b.closedDays?.includes(dow) &&
          (a.category === 'food' ? b.category === 'food' && b.meal === a.meal : b.category !== 'food'),
      )
      for (const b of pool) {
        const d = haversineKm(a.coords, b.coords)
        if (d > 4) continue
        options.push({
          kind: 'item',
          saving: (a.cost - b.cost) * travelers,
          loss:
            Math.max(0, a.rating - b.rating) * 1.5 + d * 0.35 + (b.category !== a.category ? 0.8 : 0) +
            (a.tags.includes('iconic') ? 1.6 : 0) + 0.3,
          label: `Swapped ${a.name} for ${b.name}`,
          apply: (t) => replaceItem(t, di, it.uid, b.id),
        })
      }
    }
  })
  return options
}

/** Greedily applies the best value savings until the plan fits the budget. */
export function fitToBudget(trip, dest) {
  const start = computeBudget(trip, dest)
  let current = trip
  let b = start
  const changes = []
  for (let guard = 0; guard < 30 && b.total > trip.params.budgetUSD; guard++) {
    const opts = savingOptions(current, dest)
    if (!opts.length) break
    // If one change is enough on its own, make the least painful one; otherwise best value.
    const gap = b.total - trip.params.budgetUSD
    const enough = opts.filter((o) => o.saving >= gap)
    const best = enough.length
      ? enough.reduce((x, y) => (y.loss < x.loss || (y.loss === x.loss && y.saving < x.saving) ? y : x))
      : opts.reduce((x, y) => (y.saving / (1 + y.loss) > x.saving / (1 + x.loss) ? y : x))
    const next = best.apply(current)
    const nb = computeBudget(next, dest)
    if (nb.total >= b.total) break
    changes.push({ label: best.label, saving: b.total - nb.total, kind: best.kind })
    current = next
    b = nb
  }
  return { trip: current, changes, before: start.total, after: b.total, fits: b.total <= trip.params.budgetUSD }
}
