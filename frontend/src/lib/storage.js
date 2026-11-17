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
// when VITE_TRIPS_SYNC=true (see frontend/.env.example) and the user is
// logged in. Otherwise trips stay in localStorage only.
export const cloudEnabled = env.VITE_TRIPS_SYNC === 'true'

const AUTH_KEY = 'liftoff:auth:v1'

const readAuth = () => readJSON(AUTH_KEY, null)
export const getToken = () => readAuth()?.token || null
export const getUserEmail = () => readAuth()?.email || null
export const isLoggedIn = () => Boolean(getToken())

async function request(path, options = {}, { auth = true } = {}) {
  const token = getToken()
  if (auth && !token) throw new Error('Not logged in')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (res.status === 401 && auth) window.localStorage.removeItem(AUTH_KEY)
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        detail = (await res.json()).detail || detail
      } catch {
        // keep the HTTP status message
      }
      throw new Error(detail)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function authenticate(path, email, password) {
  const json = await request(path, { method: 'POST', body: JSON.stringify({ email, password }) }, { auth: false })
  writeJSON(AUTH_KEY, { token: json.token, email: json.email })
  return json.email
}

export const signup = (email, password) => authenticate('/signup', email, password)
export const login = (email, password) => authenticate('/login', email, password)

export async function logout() {
  try {
    await request('/logout', { method: 'POST' })
  } catch {
    // logging out locally is enough if the backend can't be reached
  }
  window.localStorage.removeItem(AUTH_KEY)
}

export async function cloudSaveTrip(trip) {
  await request(`/trips/${encodeURIComponent(trip.id)}`, {
    method: 'PUT',
    body: JSON.stringify(trip),
  })
}

export async function cloudListTrips() {
  const trips = await request('/trips')
  return Array.isArray(trips) ? trips : []
}

export async function cloudDeleteTrip(id) {
  await request(`/trips/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Uploads every trip saved on this device. Call it right after login or signup. */
export async function pushLocalTrips() {
  for (const trip of loadLocalTrips()) await cloudSaveTrip(trip)
}