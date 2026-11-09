import { CATEGORIES } from '../data/categories.js'

// Exports the itinerary as an .ics calendar (Google, Apple, Outlook all import it).

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

function fold(line) {
  const chars = Array.from(line)
  if (chars.length <= 60) return line
  const parts = []
  for (let i = 0; i < chars.length; i += 60) parts.push((i ? ' ' : '') + chars.slice(i, i + 60).join(''))
  return parts.join('\r\n')
}

export function buildIcs(trip, dest, schedules) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lift Off//Trip planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(trip.title)}`]
  const now = stamp(Date.now())
  const event = (uid, start, end, summary, location, description) => {
    lines.push('BEGIN:VEVENT', `UID:${uid}-${trip.id}@liftoff.app`, `DTSTAMP:${now}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${esc(summary)}`)
    if (location) lines.push(`LOCATION:${esc(location)}`)
    if (description) lines.push(`DESCRIPTION:${esc(description)}`)
    lines.push('END:VEVENT')
  }
  const seen = new Set()
  for (const s of schedules) {
    for (const e of s.entries) {
      if (e.kind === 'flight' && !seen.has(e.flight.id)) {
        seen.add(e.flight.id)
        const f = e.flight
        event(`flight-${f.id}`, f.depart, f.arrive, `✈ ${f.flightNo} ${f.from.code} → ${f.to.code}`, `${f.from.city} (${f.from.code})`, `${f.airline.name} · ${f.stops ? `1 stop via ${f.via.city}` : 'Nonstop'} · Gate ${f.gate}`)
      } else if (e.kind === 'stop') {
        const cat = CATEGORIES[e.act.category]
        event(`stop-${e.key}`, e.start, e.end, `${cat?.emoji ?? ''} ${e.act.name}`.trim(), `${e.act.area}, ${dest.name}`, e.act.description)
      }
    }
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}
