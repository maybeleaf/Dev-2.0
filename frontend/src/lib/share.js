/**
 * A link that opens the planner pre-filled with this trip's details (route,
 * dates, group, budget, pace, interests). Edits made after planning aren't
 * included — it's a starting point, not a copy.
 */
export function shareUrl(trip) {
  const p = trip.params
  const q = new URLSearchParams({
    from: trip.originCode,
    to: trip.destinationId,
    start: p.startDate,
    end: p.endDate,
    t: String(p.travelers),
    b: String(Math.round(p.budgetUSD)),
    pace: p.pace,
    i: p.interests.join(','),
  })
  if (p.mobility === 'low-walking') q.set('m', 'low')
  return `${window.location.origin}${window.location.pathname}#/?${q}`
}
