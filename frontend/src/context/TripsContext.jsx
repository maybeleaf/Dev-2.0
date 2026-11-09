import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { cloudDeleteTrip, cloudEnabled, cloudListTrips, cloudSaveTrip, loadLocalTrips, saveLocalTrips } from '../lib/storage.js'

const TripsContext = createContext(null)

export function TripsProvider({ children }) {
  const [trips, setTrips] = useState(loadLocalTrips)
  const dirty = useRef(new Set())

  useEffect(() => {
    saveLocalTrips(trips)
  }, [trips])

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'liftoff:trips:v1') setTrips(loadLocalTrips())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Optional Appwrite sync: pull once, push changed trips (debounced).
  useEffect(() => {
    if (!cloudEnabled) return
    cloudListTrips()
      .then((remote) =>
        setTrips((local) => {
          const byId = new Map(local.map((t) => [t.id, t]))
          for (const r of remote) if (!byId.has(r.id) || (byId.get(r.id).updatedAt || 0) < (r.updatedAt || 0)) byId.set(r.id, r)
          return [...byId.values()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        }),
      )
      .catch((e) => console.warn('[Lift Off] Appwrite sync unavailable — using this device only.', e))
  }, [])
  useEffect(() => {
    if (!cloudEnabled || !dirty.current.size) return undefined
    const timer = setTimeout(() => {
      for (const id of dirty.current) {
        const t = trips.find((x) => x.id === id)
        if (t) cloudSaveTrip(t).catch((e) => console.warn('[Lift Off] Appwrite save failed', e))
      }
      dirty.current.clear()
    }, 1200)
    return () => clearTimeout(timer)
  }, [trips])

  const addTrip = useCallback((trip) => {
    dirty.current.add(trip.id)
    setTrips((ts) => [trip, ...ts.filter((t) => t.id !== trip.id)])
  }, [])

  const updateTrip = useCallback((id, updater) => {
    dirty.current.add(id)
    setTrips((ts) => ts.map((t) => (t.id === id ? (typeof updater === 'function' ? updater(t) : updater) : t)))
  }, [])

  const deleteTrip = useCallback((id) => {
    setTrips((ts) => ts.filter((t) => t.id !== id))
    if (cloudEnabled) cloudDeleteTrip(id).catch(() => {})
  }, [])

  const value = useMemo(() => ({ trips, addTrip, updateTrip, deleteTrip, getTrip: (id) => trips.find((t) => t.id === id) }), [trips, addTrip, updateTrip, deleteTrip])
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTrips() {
  const ctx = useContext(TripsContext)
  if (!ctx) throw new Error('useTrips must be used inside <TripsProvider>')
  return ctx
}
