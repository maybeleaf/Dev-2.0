import { MEALS } from '../data/categories.js'
import { dayWindow, eveningStartFor } from './schedule.js'
import { computeLeg } from './transport.js'

// "Smart sort": finds the visiting order that minimises travel while keeping
// meals in their windows, places open, and morning/evening picks at the right
// time of day. Exact branch-and-bound for ≤ 9 stops, local search beyond.

const EXACT_LIMIT = 9
const NODE_BUDGET = 350000

function buildModel({ dest, ctx, dates, dayIndex, items }) {
  const w = dayWindow(ctx, dest, dayIndex, dates)
  const valid = items.filter((it) => ctx.catalog.get(it.ref))
  const acts = valid.map((it) => ctx.catalog.get(it.ref))
  const nodes = [{ coords: ctx.stay.coords }, ...acts]
  const legCtx = { dest, travelers: ctx.params.travelers, mobility: ctx.params.mobility, hour: 12 }
  const M = nodes.map((a, i) => nodes.map((b, j) => (i === j ? 0 : computeLeg(a, b, legCtx).minutes)))
  const props = acts.map((a, i) => ({
    open: a.hours[0],
    close: a.hours[1],
    dur: a.duration / 60,
    win: a.category === 'food' && a.meal !== 'snack' ? MEALS[a.meal].window : null,
    snack: a.category === 'food' && a.meal === 'snack' ? MEALS.snack.window : null,
    eveningStart: eveningStartFor(a),
    best: a.bestTime,
    locked: Boolean(valid[i].locked),
  }))
  return { w, items: valid, M, props, n: valid.length }
}

function step(model, i, t, prev) {
  const p = model.props[i]
  const travel = model.M[prev][i + 1]
  const arrive = t + travel / 60
  let s = arrive
  if (p.win) s = Math.max(s, p.win[0])
  if (p.eveningStart) s = Math.max(s, p.eveningStart)
  s = Math.max(s, p.open)
  // Idle time first thing in the morning feels wasted; an afternoon breather doesn't.
  const waitRate = arrive < 12 ? 1.05 : arrive < 17 ? 0.45 : 0.35
  let c = travel + (s - arrive) * 60 * waitRate
  const e = s + p.dur
  if (e > p.close + 0.01) c += 400 + (e - p.close) * 120
  if (p.win && s > p.win[1] + 0.01) c += 160 + (s - p.win[1]) * 120
  if (p.snack && (s < p.snack[0] || s > p.snack[1])) c += 30 + Math.min(Math.abs(s - p.snack[0]), Math.abs(s - p.snack[1])) * 15
  if (p.best === 'morning' && s > 12.5) c += 35 + (s - 12.5) * 12
  else if (p.best === 'evening' && s < 16) c += 50 + (16 - s) * 15
  else if (p.best === 'afternoon' && (s < 11.5 || s > 18.5)) c += 20
  return { t: e, c, travel }
}

function finish(model, t, prev) {
  const back = model.M[prev][0]
  const end = t + back / 60
  return { c: back + (end > model.w.endH ? (end - model.w.endH) * 240 : 0), travel: back }
}

function evaluate(model, order) {
  let t = model.w.startH
  let prev = 0
  let cost = 0
  let travel = 0
  for (const i of order) {
    const r = step(model, i, t, prev)
    cost += r.c
    travel += r.travel
    t = r.t
    prev = i + 1
  }
  if (order.length) {
    const f = finish(model, t, prev)
    cost += f.c
    travel += f.travel
  }
  return { cost, travel }
}

function solveExact(model, init) {
  const n = model.n
  const lockedAt = init.map((idx) => (model.props[idx].locked ? idx : -1))
  let best = evaluate(model, init).cost
  let bestOrder = init.slice()
  const used = new Array(n).fill(false)
  const order = []
  let visited = 0
  const dfs = (depth, t, prev, cost) => {
    if (cost >= best - 1e-9 || visited++ > NODE_BUDGET) return
    if (depth === n) {
      const total = cost + finish(model, t, prev).c
      if (total < best - 1e-9) {
        best = total
        bestOrder = order.slice()
      }
      return
    }
    const forced = lockedAt[depth]
    const moves = []
    for (let i = 0; i < n; i++) {
      if (used[i]) continue
      if (forced >= 0 ? i !== forced : model.props[i].locked) continue
      moves.push({ i, ...step(model, i, t, prev) })
    }
    moves.sort((a, b) => a.c - b.c)
    for (const m of moves) {
      used[m.i] = true
      order.push(m.i)
      dfs(depth + 1, m.t, m.i + 1, cost + m.c)
      order.pop()
      used[m.i] = false
    }
  }
  dfs(0, model.w.startH, 0, 0)
  return bestOrder
}

function solveLocal(model, init) {
  const slots = init.map((idx, pos) => (model.props[idx].locked ? -1 : pos)).filter((p) => p >= 0)
  let free = slots.map((p) => init[p])
  const compose = (list) => {
    const out = init.slice()
    slots.forEach((p, k) => (out[p] = list[k]))
    return out
  }
  let best = evaluate(model, init).cost
  for (let iter = 0; iter < 80; iter++) {
    let improved = false
    for (let a = 0; a < free.length; a++) {
      for (let b = 0; b < free.length; b++) {
        if (a === b) continue
        const moved = free.slice()
        const [x] = moved.splice(a, 1)
        moved.splice(b, 0, x)
        const c = evaluate(model, compose(moved)).cost
        if (c < best - 1e-9) {
          best = c
          free = moved
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return compose(free)
}

/** Returns a re-ordered copy of `items` plus before/after travel minutes. */
export function optimizeDay({ dest, ctx, dates, dayIndex, items }) {
  const model = buildModel({ dest, ctx, dates, dayIndex, items })
  const init = model.items.map((_, i) => i)
  const before = evaluate(model, init)
  if (model.n < 2) return { items, changed: false, travelBefore: before.travel, travelAfter: before.travel, scoreBefore: before.cost, scoreAfter: before.cost }
  const order = model.n <= EXACT_LIMIT ? solveExact(model, init) : solveLocal(model, init)
  const after = evaluate(model, order)
  const leftovers = items.filter((it) => !ctx.catalog.get(it.ref))
  return {
    items: [...order.map((i) => model.items[i]), ...leftovers],
    changed: order.some((v, i) => v !== i),
    travelBefore: Math.round(before.travel),
    travelAfter: Math.round(after.travel),
    scoreBefore: before.cost,
    scoreAfter: after.cost,
  }
}
