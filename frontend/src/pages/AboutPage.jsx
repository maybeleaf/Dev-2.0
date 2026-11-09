import { Accessibility, ArrowRight, BedDouble, Bell, Compass, Gauge, Globe2, Mail, Plane, Radio, ShieldCheck, Sparkles, UserRound, Wallet, Wand2 } from 'lucide-react'
import { Logo } from '../components/Logo.jsx'
import { Poster } from '../components/Poster.jsx'
import { DESTINATIONS, DESTINATION_BY_ID } from '../data/index.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import '../styles/about.css'

const FEATURES = [
  { icon: Wand2, title: 'One form, whole trip', body: 'Budget, dates, where from and what you love. Lift Off picks flights, a bnb and fills every day around opening hours, meals and travel time.' },
  { icon: Radio, title: 'Live while you travel', body: 'A countdown and progress bar to your flight, leave-by alerts, a flight-progress arc, and “now / next / leave in” for every stop.' },
  { icon: Sparkles, title: 'Smart sort', body: 'Re-orders a day to cut travel time and dodge closures — pin the stops you care about and it routes around them.' },
  { icon: Compass, title: 'Search & filter everything', body: 'Find cities by vibe, month, budget or flight time; filter stays by price and amenities; search every place to eat and see.' },
  { icon: Wallet, title: 'Stays on budget', body: 'Every flight, night and coffee adds up live. Over budget? “Fit to budget” finds the least painful savings.' },
  { icon: Accessibility, title: 'Built for everyone', body: 'Text size, dyslexia-friendly fonts, high contrast, colour-blind palettes, read-aloud, voice input and emoji-or-words icons.' },
]

const STACK = [
  ['React 19 + Vite', 'Single-page app with a tiny hash router — deploys to any static host.'],
  ['Plain CSS design tokens', 'Light, dark, high-contrast and colour-vision-safe themes from one set of variables.'],
  ['JavaScript trip engine', 'Deterministic, seeded planner: flights, stays, itinerary, scheduling, budget and live timeline.'],
  ['Python FastAPI', 'Our backend proxies real historical weather (Open-Meteo) and geocoding; the app falls back to mock data.'],
  ['Appwrite', 'Optional cloud sync for saved trips (set the env vars) — otherwise everything stays in your browser.'],
  ['GitHub + cloud hosting', 'Static build on any CDN; API on any Python host.'],
]

const ROADMAP = [
  { icon: UserRound, title: 'Personal accounts', body: 'Sign in to keep trips across devices and share edit access with travel buddies.' },
  { icon: BedDouble, title: 'More hotel & bnb sources', body: 'Swap the mock stays API for real providers — the screens already use the same shape.' },
  { icon: Mail, title: 'Confirmations & notifications', body: 'Email itineraries and push the live alerts to your phone.' },
  { icon: ShieldCheck, title: 'Visa requirements', body: 'Entry rules for your passport, checked against every destination.' },
]

export function AboutPage() {
  usePageTitle('About')
  const posters = ['marrakech', 'reykjavik', 'tokyo'].map((id) => DESTINATION_BY_ID[id]).filter(Boolean)
  return (
    <div className="about">
      <section className="about-hero">
        <div className="container about-hero-inner">
          <div>
            <p className="eyebrow">About Lift Off</p>
            <h1 className="display">
              Vacation is supposed to be a break. <em className="italic-accent">Don’t make planning it a hassle.</em>
            </h1>
            <p className="lede">Lift Off turns “where should we go?” into a day-by-day plan with flights, a place to stay and a budget that adds up — then rides along with you on the trip.</p>
            <div className="row">
              <a className="btn btn-primary btn-lg" href="#/">
                Plan a trip <ArrowRight aria-hidden="true" />
              </a>
              <a className="btn btn-secondary btn-lg" href="#/live">
                <Radio aria-hidden="true" /> See it live
              </a>
            </div>
          </div>
          <div className="about-posters" aria-hidden="true">
            {posters.map((d, i) => (
              <Poster key={d.id} dest={d} ratio="poster" className={`about-poster p${i}`} />
            ))}
          </div>
        </div>
      </section>

      <div className="container page">
        <section aria-labelledby="features-title">
          <h2 id="features-title" className="about-h2">
            What it does
          </h2>
          <ul className="about-features list-plain">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="card card-pad about-feature">
                <span className="about-icon" aria-hidden="true">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="about-how" aria-labelledby="how-title">
          <h2 id="how-title" className="about-h2">
            How a plan comes together
          </h2>
          <ol className="about-steps list-plain">
            <li>
              <Plane aria-hidden="true" />
              <h3>Flights</h3>
              <p>A seeded mock flight search: real airports and airlines, believable times, layovers and prices.</p>
            </li>
            <li>
              <BedDouble aria-hidden="true" />
              <h3>Stay</h3>
              <p>A bnb-style listings API (mocked) — filtered by budget, group size and how much walking suits you.</p>
            </li>
            <li>
              <Globe2 aria-hidden="true" />
              <h3>Days</h3>
              <p>
                {DESTINATIONS.length} cities of real places, picked by your interests and pace and placed around opening hours, meals and the weather.
              </p>
            </li>
            <li>
              <Gauge aria-hidden="true" />
              <h3>Budget</h3>
              <p>Everything is priced and totalled in your currency; Lift Off trims the plan if it runs over.</p>
            </li>
            <li>
              <Bell aria-hidden="true" />
              <h3>Live</h3>
              <p>On travel day the same plan becomes a real-time dashboard with alerts and read-aloud.</p>
            </li>
          </ol>
        </section>

        <div className="about-split">
          <section className="card card-pad" aria-labelledby="a11y-title">
            <h2 id="a11y-title" className="card-title">
              <Accessibility aria-hidden="true" className="icon-inline" /> Accessibility
            </h2>
            <p>We aim for WCAG 2.2 AA everywhere. Open the “Aa” menu in the header to change:</p>
            <ul className="about-list">
              <li>Text size up to 160%, line and letter spacing</li>
              <li>Atkinson Hyperlegible or OpenDyslexic fonts</li>
              <li>Light, dark and high-contrast themes; colour-blind-safe and monochrome palettes</li>
              <li>Emoji, words, or both for every icon</li>
              <li>Read-aloud for days, budgets and live alerts; speak your trip instead of typing</li>
              <li>Reduced motion, underlined links, full keyboard support and screen-reader labels</li>
            </ul>
          </section>
          <section className="card card-pad" aria-labelledby="stack-title">
            <h2 id="stack-title" className="card-title">
              How it’s built
            </h2>
            <dl className="about-stack">
              {STACK.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section aria-labelledby="roadmap-title">
          <h2 id="roadmap-title" className="about-h2">
            Coming next
          </h2>
          <ul className="about-roadmap list-plain">
            {ROADMAP.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="about-team card card-pad" aria-labelledby="team-title">
          <Logo />
          <div>
            <h2 id="team-title">Made by Cache Me Outside</h2>
            <p className="muted">
              A hackathon project. Places are real; flights, stays and prices are mock data shaped like real APIs, so a provider can be plugged in later.{' '}
              <a href="https://github.com/maybeleaf/Dev-2.0" target="_blank" rel="noreferrer">
                Source on GitHub
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
