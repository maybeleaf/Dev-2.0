// Saved trips live in localStorage. If Appwrite env vars are set (see
// frontend/.env.example) trips also sync to an Appwrite table — the SDK is
// only downloaded in that case.

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
const cfg = {
  endpoint: env.VITE_APPWRITE_ENDPOINT,
  project: env.VITE_APPWRITE_PROJECT_ID,
  database: env.VITE_APPWRITE_DATABASE_ID,
  table: env.VITE_APPWRITE_TABLE_ID,
}
export const cloudEnabled = Boolean(cfg.endpoint && cfg.project && cfg.database && cfg.table)

let sdkPromise = null
function cloud() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const { Client, Account, TablesDB, Query } = await import('appwrite')
      const client = new Client().setEndpoint(cfg.endpoint).setProject(cfg.project)
      const account = new Account(client)
      try {
        await account.get()
      } catch {
        await account.createAnonymousSession()
      }
      return { db: new TablesDB(client), Query }
    })().catch((error) => {
      sdkPromise = null
      throw error
    })
  }
  return sdkPromise
}

const rowId = (id) => id.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 36)

export async function cloudSaveTrip(trip) {
  const { db } = await cloud()
  await db.upsertRow({
    databaseId: cfg.database,
    tableId: cfg.table,
    rowId: rowId(trip.id),
    data: {
      title: trip.title,
      destinationId: trip.destinationId,
      startDate: trip.params.startDate,
      endDate: trip.params.endDate,
      data: JSON.stringify(trip),
    },
  })
}

export async function cloudListTrips() {
  const { db, Query } = await cloud()
  const res = await db.listRows({ databaseId: cfg.database, tableId: cfg.table, queries: [Query.orderDesc('$updatedAt'), Query.limit(50)] })
  return res.rows
    .map((r) => {
      try {
        return JSON.parse(r.data)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

export async function cloudDeleteTrip(id) {
  const { db } = await cloud()
  await db.deleteRow({ databaseId: cfg.database, tableId: cfg.table, rowId: rowId(id) })
}
