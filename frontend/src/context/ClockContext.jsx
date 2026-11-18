import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// A "time machine" for demos: the whole app reads time from here, so the live
// dashboard can be fast-forwarded (60×, 600×, 3600×) or jumped to any moment.
// At speed 1 with no jump it is simply the real clock.

const ClockContext = createContext(null)
const REAL = { anchorReal: 0, anchorSim: 0, speed: 1 }

export function ClockProvider({ children }) {
  const [state, setState] = useState(REAL)

  const getNow = useCallback(() => state.anchorSim + (Date.now() - state.anchorReal) * state.speed, [state])

  const setSpeed = useCallback(
    (speed) =>
      setState((s) => {
        const now = s.anchorSim + (Date.now() - s.anchorReal) * s.speed
        return { anchorReal: Date.now(), anchorSim: now, speed }
      }),
    [],
  )
  const jumpTo = useCallback((epoch) => setState((s) => ({ anchorReal: Date.now(), anchorSim: epoch, speed: s.speed })), [])
  const reset = useCallback(() => setState(REAL), [])
  const simulated = state.speed !== 1 || state.anchorSim !== state.anchorReal

  const value = useMemo(() => ({ getNow, setSpeed, jumpTo, reset, speed: state.speed, simulated }), [getNow, setSpeed, jumpTo, reset, state.speed, simulated])
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useClock() {
  const ctx = useContext(ClockContext)
  if (!ctx) throw new Error('useClock must be used inside <ClockProvider>')
  return ctx
}

/** Re-renders every `tickMs` (faster while fast-forwarding) and returns the app's current time. */
// eslint-disable-next-line react-refresh/only-export-components
export function useNow(tickMs = 1000) {
  const { getNow, speed } = useClock()
  const [, setTick] = useState(0)
  const ms = speed > 1 ? Math.min(tickMs, 250) : tickMs
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return getNow()
}
