import { usePageTitle } from '../hooks/usePageTitle.js'

export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="container page">
      <div className="empty">
        <span className="empty-emoji emoji" aria-hidden="true">
          🛬
        </span>
        <h1>This gate doesn’t exist</h1>
        <p>The page you were looking for has departed — or never existed. Let’s get you somewhere good.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <a className="btn btn-primary" href="#/">
            Plan a trip
          </a>
          <a className="btn btn-secondary" href="#/explore">
            Explore destinations
          </a>
          <a className="btn btn-ghost" href="#/trips">
            My trips
          </a>
        </div>
      </div>
    </div>
  )
}
