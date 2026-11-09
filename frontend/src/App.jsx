import { useEffect, useRef, useState } from 'react'
import { AccessibilityPanel } from './components/AccessibilityPanel.jsx'
import { Footer, Header, TabBar } from './components/Shell.jsx'
import { ClockBadge } from './components/TimeMachine.jsx'
import { Toaster } from './components/Toaster.jsx'
import { ClockProvider } from './context/ClockContext.jsx'
import { SettingsProvider } from './context/SettingsContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { TripsProvider } from './context/TripsContext.jsx'
import { matchPath, useRoute } from './lib/router.js'
import { AboutPage } from './pages/AboutPage.jsx'
import { DestinationPage } from './pages/DestinationPage.jsx'
import { ExplorePage } from './pages/ExplorePage.jsx'
import { HomePage } from './pages/HomePage.jsx'
import { LivePage } from './pages/LivePage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'
import { TripPage } from './pages/TripPage.jsx'
import { TripsPage } from './pages/TripsPage.jsx'

function renderRoute({ path, query }) {
  let m
  if (path === '/') return <HomePage key="home" query={query} />
  if (path === '/explore') return <ExplorePage key="explore" query={query} />
  if ((m = matchPath('/destination/:id', path))) return <DestinationPage key={`d-${m.id}`} id={m.id} query={query} />
  if ((m = matchPath('/trip/:id', path))) return <TripPage key={`t-${m.id}`} id={m.id} query={query} />
  if (path === '/trips') return <TripsPage key="trips" />
  if (path === '/live') return <LivePage key="live" query={query} />
  if ((m = matchPath('/live/:id', path))) return <LivePage key={`l-${m.id}`} id={m.id} query={query} />
  if (path === '/about') return <AboutPage key="about" />
  return <NotFoundPage key="404" />
}

function Shell() {
  const route = useRoute()
  const [a11yOpen, setA11yOpen] = useState(false)
  const mainRef = useRef(null)
  const lastPath = useRef(route.path)

  // New page → back to the top, and move focus so screen readers start at the new content.
  useEffect(() => {
    if (lastPath.current === route.path) return
    lastPath.current = route.path
    window.scrollTo({ top: 0, behavior: 'instant' })
    mainRef.current?.focus({ preventScroll: true })
  }, [route.path])

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
      >
        Skip to main content
      </a>
      <Header path={route.path} onOpenA11y={() => setA11yOpen(true)} />
      <main id="main" className="site-main" ref={mainRef} tabIndex={-1}>
        {renderRoute(route)}
      </main>
      <Footer />
      <TabBar path={route.path} />
      <ClockBadge path={route.path} />
      <Toaster />
      <AccessibilityPanel open={a11yOpen} onClose={() => setA11yOpen(false)} />
    </>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <ClockProvider>
        <ToastProvider>
          <TripsProvider>
            <Shell />
          </TripsProvider>
        </ToastProvider>
      </ClockProvider>
    </SettingsProvider>
  )
}
