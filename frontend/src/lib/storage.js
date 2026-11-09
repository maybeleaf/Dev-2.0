// Saved trips live in localStorage. If VITE_TRIPS_SYNC=true (see
// frontend/.env.example) trips also sync to the backend's /trips routes.

import { API_BASE } from './api.js'
const TRIPS_KEY = 'liftoff:trips:v1'

export function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn('[Lift Off] Could not save to localStorage', error)
    return false
  }
}

export const loadLocalTrips = () => {
  const trips = readJSON(TRIPS_KEY, [])
  return Array.isArray(trips) ? trips.filter((t) => t && t.id && t.days && t.flights) : []
}
export const saveLocalTrips = (trips) => writeJSON(TRIPS_KEY, trips)

const env = import.meta.env || {}

// Trips also sync to the team's FastAPI backend (/trips in backend/main.py)
// when VITE_TRIPS_SYNC=true (see frontend/.env.example). Otherwise trips
// stay in localStorage only.
export const cloudEnabled = env.VITE_TRIPS_SYNC === 'true'

async function tripsRequest(path, options = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function cloudSaveTrip(trip) {
  await tripsRequest(`/trips/${encodeURIComponent(trip.id)}`, {
    method: 'PUT',
    body: JSON.stringify(trip),
  })
}

export async function cloudListTrips() {
  const trips = await tripsRequest('/trips')
  return Array.isArray(trips) ? trips : []
}

export async function cloudDeleteTrip(id) {
  await tripsRequest(`/trips/${encodeURIComponent(id)}`, { method: 'DELETE' })
}