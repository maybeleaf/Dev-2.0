import { fromOpenMeteo, typicalDay } from '../engine/weather.js'
import { lastYear } from './time.js'

// Talks to the team's FastAPI backend (backend/main.py). In dev, Vite proxies
// /api → http://localhost:8000. Set VITE_API_BASE to point at a deployed API.
// Everything degrades to mock data, so the UI never waits on the backend.
export const API_BASE = (import.meta.env?.VITE_API_BASE || '/api').replace(/\/$/, '')

const weatherCache = new Map()

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
 * dates (via the backend's /weather → Open-Meteo archive), else climate normals.
 */
export function fetchTripWeather(dest, dates) {
  if (!dates.length) return Promise.resolve({ source: 'typical', days: [] })
  const key = `${dest.id}|${dates[0]}|${dates[dates.length - 1]}`
  if (weatherCache.has(key)) return weatherCache.get(key)
  const typical = () => dates.map((d) => typicalDay(dest, d))
  const promise = (async () => {
    try {
      const qs = new URLSearchParams({
        location: `${dest.name}, ${dest.country}`,
        start_date: lastYear(dates[0]),
        end_date: lastYear(dates[dates.length - 1]),
      })
      const json = await getJson(`/weather?${qs}`, 5000)
      const daily = json?.weather?.daily
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
