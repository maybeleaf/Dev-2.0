import { fromOpenMeteo, typicalDay } from '../engine/weather.js'
import { lastYear } from './time.js'

// Talks to the team's FastAPI backend (backend/main.py). In dev, Vite proxies
// /api → http://localhost:8000. Set VITE_API_BASE to point at a deployed API.
// Everything degrades to mock data, so the UI never waits on the backend.
export const API_BASE = (import.meta.env?.VITE_API_BASE || '/api').replace(/\/$/, '')

// Weather and geocoding are called straight from the browser, so the deployed
// site works without the backend. Open-Meteo needs no key. The Geoapify key is
// public once built: restrict it to your site's domain in the Geoapify dashboard.
const OPEN_METEO_URL = 'https://archive-api.open-meteo.com/v1/archive'
const GEOAPIFY_URL = 'https://api.geoapify.com/v1/geocode/search'
const GEOAPIFY_KEY = import.meta.env?.VITE_GEOAPIFY_API_KEY || ''

const weatherCache = new Map()

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Look up a place with Geoapify. Returns {name, lat, lon} or null. */
export async function geocode(text) {
  if (!GEOAPIFY_KEY || !text?.trim()) return null
  const qs = new URLSearchParams({ text, format: 'json', limit: '1', apiKey: GEOAPIFY_KEY })
  const json = await fetchJson(`${GEOAPIFY_URL}?${qs}`, 5000)
  const r = json?.results?.[0]
  return r ? { name: r.name || r.formatted || text, lat: r.lat, lon: r.lon } : null
}

async function getJson(path, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = res.headers.get('content-type') || ''
    if (!type.includes('json')) throw new Error('Not JSON')
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function postJson(path, body, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const type = res.headers.get('content-type') || ''
    if (!type.includes('json')) throw new Error('Not JSON')
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask the backend ranker (POST /stays/rank, Christian's PR) to order stays.
 * Only the fields the ranker reads are sent; results are matched back by id.
 *
 * budget is the STAYS budget for the whole trip (not the trip total).
 * mode: 'cheapest' | 'balanced' | 'nicest'. weights (optional) overrides mode.
 *
 * Resolves to { ranked: [{ id, score }], warning, weights } or throws if the
 * backend is down / the route isn't deployed yet, so callers can fall back.
 */
export async function rankStays({ stays, budget, nights, mode = 'balanced', weights, topN = 100 }) {
  const json = await postJson(
    '/stays/rank',
    {
      stays: stays.map((s) => ({ id: s.id, name: s.title, pricePerNight: s.pricePerNight, rating: s.rating })),
      budget,
      nights,
      mode,
      ...(weights ? { weights } : {}),
      sort_by: 'score',
      top_n: Math.min(100, Math.max(1, topN)),
    },
    4000,
  )
  if (!Array.isArray(json?.results)) throw new Error('Bad ranker response')
  return {
    ranked: json.results.map((r) => ({ id: r.id, score: Number(r.score) || 0 })),
    warning: json.warning || null,
    weights: json.weights || null,
  }
}

export async function checkBackend() {
  try {
    const json = await getJson('/health', 2500)
    return json?.status === 'ok'
  } catch {
    return false
  }
}

/**
 * Weather for the trip dates. Uses last year's real observations for the same
 * dates (Open-Meteo archive, called directly), else climate normals.
 */
export function fetchTripWeather(dest, dates) {
  if (!dates.length) return Promise.resolve({ source: 'typical', days: [] })
  const key = `${dest.id}|${dates[0]}|${dates[dates.length - 1]}`
  if (weatherCache.has(key)) return weatherCache.get(key)
  const typical = () => dates.map((d) => typicalDay(dest, d))
  const promise = (async () => {
    try {
      const qs = new URLSearchParams({
        latitude: String(dest.coords[0]),
        longitude: String(dest.coords[1]),
        start_date: lastYear(dates[0]),
        end_date: lastYear(dates[dates.length - 1]),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration',
        timezone: 'auto',
      })
      const json = await fetchJson(`${OPEN_METEO_URL}?${qs}`, 5000)
      const daily = json?.daily
      if (!daily?.time?.length) throw new Error('No daily data')
      const days = dates.map((d) => {
        const i = daily.time.indexOf(lastYear(d))
        if (i < 0 || daily.temperature_2m_max[i] == null || daily.temperature_2m_min[i] == null) return typicalDay(dest, d)
        return fromOpenMeteo(d, {
          max: daily.temperature_2m_max[i],
          min: daily.temperature_2m_min[i],
          precip: daily.precipitation_sum[i] ?? 0,
          sunshineSec: daily.sunshine_duration[i] ?? 0,
        })
      })
      return { source: 'open-meteo', days }
    } catch (error) {
      weatherCache.delete(key) // allow a retry once the backend is up
      return { source: 'typical', days: typical(), error: error.message }
    }
  })()
  weatherCache.set(key, promise)
  return promise
}
