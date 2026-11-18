// Time model: every scheduled moment is an absolute epoch (ms). Trip dates are
// plain 'YYYY-MM-DD' strings. Wall-clock times are converted per IANA time zone
// with Intl, so a flight leaving Toronto at 18:30 lands at the right local hour.

const pad = (n) => String(n).padStart(2, '0')
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const DAY_MS = 86400000

const partsCache = new Map()
function partsFormatter(timeZone) {
  let f = partsCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsCache.set(timeZone, f)
  }
  return f
}

export function userTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function zonedParts(epoch, timeZone) {
  const o = {}
  for (const p of partsFormatter(timeZone).formatToParts(new Date(epoch))) o[p.type] = p.value
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour) % 24,
    minute: Number(o.minute),
    second: Number(o.second),
    dow: WEEKDAYS[o.weekday],
  }
}

/** Minutes the zone is ahead of UTC at that instant (Lisbon summer → 60). */
export function tzOffsetMinutes(epoch, timeZone) {
  const p = zonedParts(epoch, timeZone)
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUTC - Math.floor(epoch / 1000) * 1000) / 60000)
}

/** Local wall time (date + decimal hours, may exceed 24) in a zone → epoch ms. */
export function zonedToEpoch(dateStr, hours, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wall = Date.UTC(y, m - 1, d, 0, Math.round(hours * 60))
  const guess = wall - tzOffsetMinutes(wall, timeZone) * 60000
  return wall - tzOffsetMinutes(guess, timeZone) * 60000
}

/** Epoch → { date, hours (decimal), dow } in a zone. */
export function epochToZoned(epoch, timeZone) {
  const p = zonedParts(epoch, timeZone)
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    hours: p.hour + p.minute / 60 + p.second / 3600,
    dow: p.dow,
  }
}

// ——— date-only helpers (UTC math so local DST never shifts a date) ———
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
export const toDateStr = (ms) => {
  const dt = new Date(ms)
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}
export const addDays = (s, n) => toDateStr(parseDate(s) + n * DAY_MS)
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY_MS)
export const dowOf = (s) => new Date(parseDate(s)).getUTCDay()
export const monthOf = (s) => Number(s.slice(5, 7))
export const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toDateStr(parseDate(s)) === s
export function todayStr(timeZone = userTimeZone(), now = Date.now()) {
  return epochToZoned(now, timeZone).date
}
export function dateRange(start, end) {
  const out = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}
/** Same month/day one year earlier (Feb 29 → Feb 28). */
export function lastYear(s) {
  const [y, m, d] = s.split('-').map(Number)
  const day = m === 2 && d === 29 ? 28 : d
  return `${y - 1}-${pad(m)}-${pad(day)}`
}

// ——— formatting ———
const fmtCache = new Map()
function cachedFormat(key, opts) {
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, opts)
    fmtCache.set(key, f)
  }
  return f
}

export function formatTime(epoch, timeZone, hour12 = true) {
  return cachedFormat(`t|${timeZone}|${hour12}`, { hour: 'numeric', minute: '2-digit', hour12, timeZone }).format(epoch)
}

export function formatDate(dateStr, style = 'medium') {
  const opts = {
    short: { month: 'short', day: 'numeric' },
    medium: { weekday: 'short', month: 'short', day: 'numeric' },
    long: { weekday: 'long', month: 'long', day: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    weekday: { weekday: 'short' },
    month: { month: 'long' },
  }[style]
  return cachedFormat(`d|${style}`, { ...opts, timeZone: 'UTC' }).format(parseDate(dateStr))
}

export function formatEpochDate(epoch, timeZone, style = 'medium') {
  return formatDate(epochToZoned(epoch, timeZone).date, style)
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export function formatDurationShort(minutes) {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${pad(r)}m` : `${h}h`
}

export function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export function formatCountdown(ms) {
  const { days, hours, minutes, seconds } = countdownParts(ms)
  if (days > 0) return `${days}d ${hours}h ${pad(minutes)}m`
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`
  return `${seconds}s`
}

/** Spoken-friendly countdown: "2 days and 4 hours", "35 minutes". */
export function describeCountdown(ms) {
  const { days, hours, minutes } = countdownParts(ms)
  const part = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (days > 0) return hours ? `${part(days, 'day')} and ${part(hours, 'hour')}` : part(days, 'day')
  if (hours > 0) return minutes ? `${part(hours, 'hour')} and ${part(minutes, 'minute')}` : part(hours, 'hour')
  if (minutes > 0) return part(minutes, 'minute')
  return 'less than a minute'
}

export function hoursLabel(hours, hour12 = true) {
  const h = Math.floor(hours) % 24
  const m = Math.round((hours - Math.floor(hours)) * 60)
  if (!hour12) return `${pad(h)}:${pad(m)}`
  const suffix = h < 12 ? 'AM' : 'PM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m ? `${hh}:${pad(m)} ${suffix}` : `${hh} ${suffix}`
}
