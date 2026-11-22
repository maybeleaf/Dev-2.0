import { useEffect, useMemo, useState } from 'react'
import { rankStays } from '../lib/api.js'

/**
 * Sends the stays on screen to the backend ranker and keeps the answer.
 *
 * status: 'off'      — ranking not requested
 *         'loading'  — waiting on the backend
 *         'ok'       — scores is a Map(id -> 0..1), ranked best first
 *         'offline'  — backend/route unavailable; caller should fall back
 *
 * Stays the ranker filtered out (over the stay budget) are simply missing
 * from scores.
 */
export function useStayRanking({ stays, budget, nights, mode, enabled }) {
  const ids = stays.map((s) => s.id).join(',')
  const key = enabled ? `${ids}|${Math.round(budget)}|${nights}|${mode}` : ''
  const [state, setState] = useState({ key: '', status: 'off' })

  useEffect(() => {
    if (!key || budget <= 0) return
    let alive = true
    rankStays({ stays, budget, nights, mode, topN: stays.length })
      .then(({ ranked, warning, weights }) => {
        if (!alive) return
        setState({ key, status: 'ok', scores: new Map(ranked.map((r) => [r.id, r.score])), warning, weights })
      })
      .catch(() => alive && setState({ key, status: 'offline' }))
    return () => {
      alive = false
    }
    // stays/budget are captured through `key`; re-running on identity changes would spam the backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => {
    if (!key) return { status: 'off' }
    if (budget <= 0) return { status: 'ok', scores: new Map(), warning: 'There’s no money left for a stay once flights and days out are counted.', weights: null }
    if (state.key !== key) return { status: 'loading' }
    return state
  }, [key, state, budget])
}
