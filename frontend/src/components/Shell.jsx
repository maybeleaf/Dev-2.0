import { useEffect, useState } from 'react'
import { Compass, Luggage, Moon, Radio, Sparkles, Sun, Info } from 'lucide-react'
import { useNow } from '../context/ClockContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { checkBackend } from '../lib/api.js'
import { href } from '../lib/router.js'
import { cloudEnabled } from '../lib/storage.js'
import { Logo } from './Logo.jsx'

const NAV = [
  { path: '/', label: 'Plan', icon: Sparkles, match: (p) => p === '/' || p === '/plan' },
  { path: '/explore', label: 'Explore', icon: Compass, match: (p) => p.startsWith('/explore') || p.startsWith('/destination') },
  { path: '/trips', label: 'My trips', icon: Luggage, match: (p) => p.startsWith('/trips') || p.startsWith('/trip/') },
  { path: '/live', label: 'Live', icon: Radio, match: (p) => p.startsWith('/live') },
]

const HOUR = 3600000

/** True when some saved trip is within a day of departure or under way. */
function useLiveTrip() {
  const { trips } = useTrips()
  const now = useNow(30000)
  return trips.some((t) => {
    const ob = t.flights.outbound.find((f) => f.id === t.selected.outbound)
    const ib = t.flights.inbound.find((f) => f.id === t.selected.inbound)
    return ob && ib && now > ob.depart - 24 * HOUR && now < ib.arrive
  })
}

export function Header({ path, onOpenA11y }) {
  const { resolvedTheme, update } = useSettings()
  const { trips } = useTrips()
  const live = useLiveTrip()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const dark = resolvedTheme !== 'light'

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-inner">
        <a className="header-logo" href="#/" aria-label="Lift Off home">
          <Logo />
        </a>
        <nav className="header-nav" aria-label="Main">
          {NAV.map(({ path: p, label, icon: Icon, match }) => (
            <a key={p} href={href(p)} className="nav-link" aria-current={match(path) ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {p === '/trips' && trips.length > 0 && <span className="nav-count">{trips.length}</span>}
              {p === '/live' && live && <span className="live-dot" aria-label="A trip is live" />}
            </a>
          ))}
        </nav>
        <div className="header-tools">
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => update({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>
            {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-secondary a11y-btn" onClick={onOpenA11y} aria-haspopup="dialog">
            <span className="a11y-aa" aria-hidden="true">
              Aa
            </span>
            <span className="a11y-btn-label">Accessibility</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export function TabBar({ path }) {
  const live = useLiveTrip()
  return (
    <nav className="tabbar" aria-label="Main (mobile)">
      {NAV.map(({ path: p, label, icon: Icon, match }) => (
        <a key={p} href={href(p)} className="tabbar-link" aria-current={match(path) ? 'page' : undefined}>
          <span className="tabbar-icon">
            <Icon aria-hidden="true" />
            {p === '/live' && live && <span className="live-dot" />}
          </span>
          <span>{label === 'My trips' ? 'Trips' : label}</span>
        </a>
      ))}
    </nav>
  )
}

export function Footer() {
  const [api, setApi] = useState('checking')
  useEffect(() => {
    let alive = true
    checkBackend().then((ok) => alive && setApi(ok ? 'up' : 'down'))
    return () => {
      alive = false
    }
  }, [])
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="stack" style={{ '--stack-gap': '0.8rem' }}>
          <Logo size={34} />
          <p className="footer-tagline">Vacation is supposed to be a break — don’t make planning it a hassle.</p>
          <p className="muted small">
            Made with ☕ by <strong>Cache Me Outside</strong>.
          </p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          <a href="#/">Plan a trip</a>
          <a href="#/explore">Explore destinations</a>
          <a href="#/trips">My trips</a>
          <a href="#/live">Live dashboard</a>
          <a href="#/about">About & accessibility</a>
          <a href="https://github.com/maybeleaf/Dev-2.0" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </nav>
        <div className="stack footer-status" style={{ '--stack-gap': '0.6rem' }}>
          <p className="small">
            <Info aria-hidden="true" className="icon-inline" /> Flights, stays and prices are <strong>mock data</strong> for this demo — nothing is booked or charged.
          </p>
          <p className="small status-line">
            <span className={`status-dot ${api}`} aria-hidden="true" />
            {api === 'up' ? 'Weather API connected (Open-Meteo history)' : api === 'down' ? 'Weather: using climate averages (API offline)' : 'Checking weather API…'}
          </p>
          <p className="small status-line">
            <span className={`status-dot ${cloudEnabled ? 'up' : 'local'}`} aria-hidden="true" />
            {cloudEnabled ? 'Trips sync to Appwrite' : 'Trips saved on this device'}
          </p>
        </div>
      </div>
    </footer>
  )
}
