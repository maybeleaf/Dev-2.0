import { useState } from 'react'

function App() {
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="logo" href="#top">Lift Off</a>
        <label className="header-search">
          <span className="sr-only">Search destinations</span>
          <input type="search" placeholder="Search destinations" />
          <span aria-hidden="true">⌕</span>
        </label>
        <div className="header-actions">
          <nav id="site-navigation" className="navigation">
            <a href="#explore">Explore</a>
          </nav>
          <div className="menu-wrap">
            <button
              className="menu-button"
              type="button"
              aria-expanded={accountOpen}
              aria-controls="account-menu"
              onClick={() => setAccountOpen(!accountOpen)}
            >
              Menu <span aria-hidden="true">⌄</span>
            </button>
            {accountOpen && (
              <div className="dropdown" id="account-menu">
                <button type="button" onClick={() => setAccountOpen(false)}>Saved trips</button>
                <button type="button" onClick={() => setAccountOpen(false)}>Preferences</button>
                <button type="button" onClick={() => setAccountOpen(false)}>About Lift Off</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">Travel planning, simplified</p>
          <h1>Where will you go next?</h1>
          <p className="hero-text">
            Vacation is supposed to be a break, don't make planning it a hassle.
          </p>
        </section>

        <section className="section" id="explore">
          <div className="section-heading">
            <p className="eyebrow">Start here</p>
            <h2>Or browse an idea.</h2>
          </div>
          <div className="quick-options">
            <a href="#explore">A warm weekend</a>
            <a href="#explore">A change of scenery</a>
            <a href="#explore">Somewhere new</a>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact">Lift Off · Take the long way</footer>
    </div>
  )
}

export default App