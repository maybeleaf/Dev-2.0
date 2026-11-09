import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { AIRPORT_BY_CODE, DESTINATION_BY_ID } from '../data/index.js'
import { computeBudget } from '../engine/budget.js'
import { scheduleTrip, tripContext } from '../engine/schedule.js'
import { typicalDay } from '../engine/weather.js'
import { fetchTripWeather } from '../lib/api.js'

/** Everything a trip screen needs, derived once per edit. */
export function useTripView(id) {
  const { trips, updateTrip } = useTrips()
  const { push } = useToast()
  const trip = trips.find((t) => t.id === id) || null
  const dest = trip ? DESTINATION_BY_ID[trip.destinationId] || null : null
  const origin = trip ? AIRPORT_BY_CODE[trip.originCode] || null : null

  const schedules = useMemo(() => (trip && dest ? scheduleTrip(trip, dest) : []), [trip, dest])
  const budget = useMemo(() => (trip && dest ? computeBudget(trip, dest, schedules) : null), [trip, dest, schedules])
  const ctx = useMemo(() => (trip && dest ? tripContext(trip, dest) : null), [trip, dest])

  /** Applies an edit; with `undo` it shows a toast that can revert it. */
  const apply = useCallback(
    (fn, undo) => {
      if (!trip) return
      const before = trip
      const after = fn(trip)
      if (!after || after === before) return
      updateTrip(trip.id, after)
      if (undo) {
        push({
          title: undo.title,
          body: undo.body,
          emoji: undo.emoji,
          tone: undo.tone || 'success',
          action: { label: 'Undo', onClick: () => updateTrip(before.id, before) },
        })
      }
    },
    [trip, updateTrip, push],
  )

  return { trip, dest, origin, schedules, budget, ctx, apply }
}

/** Weather for the trip dates: last year's real data via the backend, else climate normals. */
export function useTripWeather(dest, dates) {
  const key = dest && dates.length ? `${dest.id}|${dates[0]}|${dates[dates.length - 1]}|${dates.length}` : ''
  const [result, setResult] = useState({ key: '', data: null })
  useEffect(() => {
    if (!key) return undefined
    let alive = true
    fetchTripWeather(dest, dates).then((data) => {
      if (alive) setResult({ key, data })
    })
    return () => {
      alive = false
    }
    // `key` captures dest + dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const typical = useMemo(
    () => (dest ? dates.map((d) => typicalDay(dest, d)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  if (result.key === key && result.data) return { ...result.data, loading: false }
  return { source: 'typical', days: typical, loading: Boolean(key) }
}
