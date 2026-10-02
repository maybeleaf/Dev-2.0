import { useState } from 'react'
import goodnightoldfriend from './assets/goodnightolfriend.jpeg'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="logo" href="#top">Lift Off</a>
        <button
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          Menu
        </button>
        <nav id="site-navigation" className={menuOpen ? 'navigation is-open' : 'navigation'}>
          <a href="#explore" onClick={() => setMenuOpen(false)}>Explore</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Travel planning, simplified</p>
            <h1>Find your next place to go.</h1>
            <p className="hero-text">
              Lift Off will help you turn a few preferences into a trip worth taking.
            </p>
            <a className="primary-link" href="#explore">Start exploring</a>
          </div>
          <img src={goodnightoldfriend} alt="A scenic travel destination" />
        </section>

        <section className="section" id="explore">
          <p className="eyebrow">Explore</p>
          <h2>Tell us what sounds good.</h2>
          <div className="placeholder-grid">
            <div className="placeholder-item">Budget</div>
            <div className="placeholder-item">Trip length</div>
            <div className="placeholder-item">Climate</div>
            <div className="placeholder-item">Interests</div>
          </div>
        </section>

        <section className="section section-muted" id="how-it-works">
          <p className="eyebrow">How it works</p>
          <h2>A simple starting point for better trips.</h2>
          <p>Choose your preferences, browse ideas, and shape the plan from there.</p>
        </section>

        <section className="section" id="about">
          <p className="eyebrow">About Lift Off</p>
          <h2>More thoughtful travel starts here.</h2>
        </section>
      </main>

      <footer className="site-footer">Lift Off</footer>
    </div>
  )
}

export default App