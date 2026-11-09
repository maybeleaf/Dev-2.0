import { useEffect, useState } from 'react'

// Tiny hash router: works on any static host (Appwrite Sites, GitHub Pages,
// Netlify…) with no server rewrites. Routes look like #/trip/abc?tab=budget.

function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, query = ''] = raw.split('?')
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(query)), raw }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function href(path, query) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : ''
  return `#${path}${qs ? `?${qs}` : ''}`
}

export function navigate(path, query, { replace = false } = {}) {
  const target = href(path, query)
  if (replace) window.history.replaceState(null, '', target)
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else window.location.hash = target.slice(1)
}

/** Updates query params on the current route without adding history entries. */
export function setQuery(patch) {
  const { path, query } = parse()
  navigate(path, { ...query, ...patch }, { replace: true })
}

export function matchPath(pattern, path) {
  const p = pattern.split('/').filter(Boolean)
  const a = path.split('/').filter(Boolean)
  if (p.length !== a.length) return null
  const params = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}
