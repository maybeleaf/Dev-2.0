import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowRight, BellRing, Clock, Compass, Gauge, ListChecks, Radio, Route, Wallet, Wand2 } from 'lucide-react'
import { DestinationCard } from '../components/DestinationCard.jsx'
import { PlanningOverlay } from '../components/PlanningOverlay.jsx'
import { Poster } from '../components/Poster.jsx'
import { SmartFill } from '../components/SmartFill.jsx'
import { TripBuilder } from '../components/TripBuilder.jsx'
import { Emoji } from '../components/ui.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useTrips } from '../context/TripsContext.jsx'
import { VIBES } from '../data/categories.js'
import { AIRPORTS, AIRPORT_BY_CODE, DESTINATIONS, DESTINATION_BY_ID } from '../data/index.js'
import { estimateTripCost, PlanError, planTrip, validateParams } from '../engine/planTrip.js'
import { rankDestinations } from '../engine/recommend.js'
import { parseTripText } from '../engine/smartFill.js'
import { useFormat } from '../hooks/useFormat.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { fromUSD, niceStep, toUSD } from '../lib/money.js'
import { navigate } from '../lib/router.js'
import { sampleTrip } from '../lib/sampleTrip.js'
import { addDays, diffDays, formatDate, isValidDateStr, monthOf, todayStr } from '../lib/time.js'
import '../styles/home.css'

/** A random item. Only reached from click handlers ("Surprise me" and the idea cards). */
const pickOne = (list) => list[Math.floor(Math.random() * list.length)]

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const IDEAS = [
  { key: 'warm', emoji: '☀️', title: 'Chase the sun', text: 'Somewhere warm for your dates', vibes: ['warm', 'beach'], interests: ['relax', 'food', 'sightseeing'] },
  { key: 'food', emoji: '🍜', title: 'Big-city food crawl', text: 'Markets, street food, late dinners', vibes: ['city', 'food', 'nightlife'], interests: ['food', 'nightlife', 'shopping'], pace: 'packed' },
  { key: 'mountains', emoji: '🏔️', title: 'Mountains & fresh air', text: 'Trails, lakes and early nights', vibes: ['mountains', 'scenic', 'adventure'], interests: ['nature', 'sightseeing', 'relax'], pace: 'relaxed' },
  { key: 'budget', emoji: '💸', title: 'Small budget, big weekend', text: '4 days, about $1,500 all-in', vibes: ['budget'], days: 4, budgetUSD: 1500, travelers: 1, interests: ['sightseeing', 'food', 'culture'] },
  { key: 'culture', emoji: '🏛️', title: 'Culture deep-dive', text: 'Museums, history and architecture', vibes: ['culture'], interests: ['culture', 'sightseeing', 'food'] },
  { key: 'new', emoji: '🧭', title: 'Somewhere new', text: 'A place you haven’t planned yet', vibes: ['offbeat'], fresh: true },
]

const reasonText = (reasons, month) =>
  reasons
    .slice(0, 3)
    .map((r) => (r === 'season' ? `great in ${MONTH_NAMES[month - 1]}` : r === 'budget' ? 'fits your budget' : VIBES[r]?.label.toLowerCase()))
    .filter(Boolean)
    .join(' · ')

function initialForm(query, settings, today) {
  const start = isValidDateStr(query.start) && query.start >= today ? query.start : addDays(today, 21)
  const end = isValidDateStr(query.end) && query.end > start ? query.end : addDays(start, 5)
  return {
    origin: AIRPORT_BY_CODE[query.from] ? query.from : settings.homeAirport,
    destination: DESTINATION_BY_ID[query.to] ? query.to : '',
    startDate: start,
    endDate: end,
    travelers: Math.max(1, Math.min(6, Number(query.t) || 2)),
    // Shared links carry the budget in USD; show it in this person's currency.
    budget: Number(query.b) > 0 ? Math.round(fromUSD(Number(query.b), settings.currency)) : '',
    budgetTouched: Number(query.b) > 0,
    interests: query.i ? query.i.split(',').filter(Boolean) : ['sightseeing', 'food', 'culture'],
    pace: ['relaxed', 'balanced', 'packed'].includes(query.pace) ? query.pace : 'balanced',
    mobility: query.m === 'low' ? 'low-walking' : 'standard',
  }
}

export function HomePage({ query }) {
  usePageTitle('')
  const { settings } = useSettings()
  const { push } = useToast()
  const { trips, addTrip } = useTrips()
  const fmt = useFormat()
  const today = todayStr()
  const [form, setForm] = useState(() => initialForm(query, settings, today))
  const [errors, setErrors] = useState({})
  const [showSummary, setShowSummary] = useState(false)
  const [planning, setPlanning] = useState(null)
  const summaryRef = useRef(null)

  const origin = AIRPORT_BY_CODE[form.origin] || null
  const dest = DESTINATION_BY_ID[form.destination] || null
  const days = isValidDateStr(form.startDate) && isValidDateStr(form.endDate) ? diffDays(form.startDate, form.endDate) + 1 : 0
  const estUSD = dest && origin && days > 1 ? estimateTripCost(dest, origin, { days, travelers: form.travelers }) : null
  const step = niceStep(fmt.currency)
  const autoBudget = Math.ceil(fromUSD(estUSD ? estUSD * 1.08 : 2500, fmt.currency) / step) * step
  const budgetDisplay = form.budgetTouched ? form.budget : autoBudget
  const budgetUSD = toUSD(Number(budgetDisplay) || 0, fmt.currency)

  const setField = useCallback((patch) => {
    setForm((f) => {
      const next = { ...f, ...patch }
      // Keep the trip length when the start date moves.
      if (patch.startDate && isValidDateStr(patch.startDate) && isValidDateStr(f.startDate) && isValidDateStr(f.endDate)) {
        const len = Math.max(1, diffDays(f.startDate, f.endDate))
        if (!isValidDateStr(next.endDate) || next.endDate <= patch.startDate || !patch.endDate) next.endDate = addDays(patch.startDate, len)
      }
      return next
    })
    setErrors((e) => {
      const keys = Object.keys(patch)
      if (!keys.some((k) => e[k] || (k === 'budgetTouched' && e.budget))) return e
      const n = { ...e }
      for (const k of keys) delete n[k]
      if (keys.includes('budget')) delete n.budget
      return n
    })
  }, [])

  const month = isValidDateStr(form.startDate) ? monthOf(form.startDate) : monthOf(today)

  const featured = useMemo(
    () => rankDestinations(DESTINATIONS, { interests: form.interests, budgetUSD, days: days || 5, travelers: form.travelers, origin, month }).slice(0, 8),
    [form.interests, budgetUSD, days, form.travelers, origin, month],
  )

  const scrollToForm = () => document.getElementById('plan-form')?.scrollIntoView({ behavior: settings.motion === 'reduce' ? 'auto' : 'smooth', block: 'start' })

  // ——— Smart fill ———
  const applySmart = (text) => {
    const parsed = parseTripText(text, { airports: AIRPORTS, destinations: DESTINATIONS, today, defaultCurrency: fmt.currency })
    const patch = {}
    const chips = [...parsed.chips]
    if (parsed.originCode) patch.origin = parsed.originCode
    if (parsed.destinationId) patch.destination = parsed.destinationId
    const start = parsed.startDate || (parsed.days ? form.startDate : null)
    if (start) {
      patch.startDate = start
      patch.endDate = addDays(start, (parsed.days || Math.max(2, days) || 6) - 1)
    }
    if (parsed.travelers) patch.travelers = parsed.travelers
    if (parsed.budget) {
      patch.budget = Math.round(fromUSD(toUSD(parsed.budget.amount, parsed.budget.currency), fmt.currency))
      patch.budgetTouched = true
    }
    if (parsed.interests.length) patch.interests = [...new Set(parsed.interests)]
    if (parsed.pace) patch.pace = parsed.pace
    if (parsed.mobility) patch.mobility = parsed.mobility
    if (!parsed.destinationId && (parsed.vibes.length || parsed.interests.length)) {
      const o = AIRPORT_BY_CODE[patch.origin || form.origin]
      const m = monthOf(patch.startDate || form.startDate)
      const [best] = rankDestinations(DESTINATIONS, {
        vibes: parsed.vibes,
        interests: parsed.interests,
        budgetUSD: patch.budget ? toUSD(patch.budget, fmt.currency) : undefined,
        days: parsed.days || days || 5,
        travelers: patch.travelers || form.travelers,
        origin: o,
        month: m,
      }).filter((r) => r.dest.airport.code !== (patch.origin || form.origin))
      if (best) {
        patch.destination = best.dest.id
        chips.push({ key: 'suggested', emoji: '✨', label: `Suggested: ${best.dest.name}` })
      }
    }
    if (Object.keys(patch).length) {
      setField(patch)
      setShowSummary(false)
    }
    return { chips }
  }

  // ——— Surprise me / ideas ———
  const suggest = (opts = {}) => {
    const ranked = rankDestinations(DESTINATIONS, {
      vibes: opts.vibes || [],
      interests: opts.interests || form.interests,
      budgetUSD: opts.budgetUSD || budgetUSD,
      days: opts.days || days || 5,
      travelers: opts.travelers || form.travelers,
      origin,
      month,
    }).filter((r) => r.dest.id !== form.destination && r.dest.airport.code !== form.origin && (!opts.fresh || !trips.some((t) => t.destinationId === r.dest.id)))
    const pool = ranked.slice(0, opts.vibes ? 2 : 4)
    return pickOne(pool) || ranked[0]
  }

  const onSurprise = () => {
    const pick = suggest()
    if (!pick) return
    setField({ destination: pick.dest.id })
    push({ title: `How about ${pick.dest.name}?`, body: reasonText(pick.reasons, month) || pick.dest.tagline, emoji: '🎲', tone: 'info' })
  }

  const onIdea = (idea) => {
    const pick = suggest(idea)
    if (!pick) return
    const patch = { destination: pick.dest.id }
    if (idea.interests) patch.interests = idea.interests
    if (idea.pace) patch.pace = idea.pace
    if (idea.travelers) patch.travelers = idea.travelers
    if (idea.days) patch.endDate = addDays(form.startDate, idea.days - 1)
    if (idea.budgetUSD) {
      patch.budget = Math.round(fromUSD(idea.budgetUSD, fmt.currency) / step) * step
      patch.budgetTouched = true
    }
    setField(patch)
    push({ title: `${idea.emoji} Try ${pick.dest.name}`, body: reasonText(pick.reasons, month) || pick.dest.tagline, tone: 'info' })
    scrollToForm()
  }

  // ——— Planning ———
  const startPlanning = (params, d, o, { live = false } = {}) => {
    let trip
    try {
      trip = planTrip(params, { dest: d, origin: o })
    } catch (err) {
      if (err instanceof PlanError) {
        setErrors({ endDate: err.message })
        setShowSummary(true)
        requestAnimationFrame(() => summaryRef.current?.focus())
        return
      }
      throw err
    }
    const stops = trip.days.reduce((n, day) => n + day.items.length, 0)
    setPlanning({
      trip,
      dest: d,
      live,
      steps: [
        `Comparing ${trip.flights.outbound.length + trip.flights.inbound.length} flights from ${o.city}`,
        `Checking ${trip.stays.length} bnb stays across ${d.neighborhoods.length} neighbourhoods`,
        `Fitting ${stops} stops around opening hours, meals and travel time`,
        `Balancing it all against your ${fmt.money(params.budgetUSD)} budget`,
      ],
    })
  }

  const onSubmit = (e) => {
    e.preventDefault()
    const params = {
      startDate: form.startDate,
      endDate: form.endDate,
      travelers: form.travelers,
      budgetUSD,
      currency: fmt.currency,
      interests: form.interests,
      pace: form.pace,
      mobility: form.mobility,
    }
    const errs = validateParams(params, { origin, dest, today })
    if (!form.interests.length) errs.interests = 'Pick at least one thing you enjoy.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      setShowSummary(true)
      requestAnimationFrame(() => summaryRef.current?.focus())
      return
    }
    setShowSummary(false)
    startPlanning(params, dest, origin)
  }

  const onSample = (live = false) => {
    const s = sampleTrip({ origin, homeAirport: settings.homeAirport, today, currency: fmt.currency, live })
    startPlanning(s.params, s.dest, s.origin, { live })
  }

  const finishPlanning = useCallback(() => {
    if (!planning) return
    const { trip, live } = planning
    addTrip(trip)
    setPlanning(null)
    push({ title: `${trip.title} — planned!`, body: live ? 'Time machine is on — use the dock to jump through the trip.' : 'Tweak anything: swap stops, change flights, or tap “Smart sort”.', emoji: '🎉', tone: 'success' })
    navigate(live ? `/live/${trip.id}` : `/trip/${trip.id}`, live ? { demo: 1 } : undefined)
  }, [planning, addTrip, push])

  const heroDests = useMemo(() => {
    const ids = ['lisbon', 'tokyo', 'marrakech', 'banff', 'bali', 'paris']
    return ids.map((id) => DESTINATION_BY_ID[id]).filter(Boolean).slice(0, 3)
  }, [])

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow">
              <Emoji>✈️</Emoji> Flights, a bnb and every hour — planned in seconds
            </p>
            <h1 id="hero-title" className="hero-title display">
              Vacation is supposed to be a <span className="italic-accent">break.</span>
            </h1>
            <p className="lede hero-lede">
              Don’t make planning it a hassle. Tell Lift Off where, when and how much — it builds the whole trip around opening hours and your budget, then keeps you on time while you travel.
            </p>
            <SmartFill onApply={applySmart} />
          </div>
          <div className="hero-art" aria-hidden="true">
            {heroDests.map((d, i) => (
              <div key={d.id} className={`hero-poster hero-poster-${i}`}>
                <Poster dest={d} ratio="poster">
                  <div className="poster-title">
                    <p className="poster-name">{d.name}</p>
                    <p className="poster-country">{d.country}</p>
                  </div>
                </Poster>
              </div>
            ))}
            <div className="hero-ticket">
              <span className="mono hero-ticket-route">
                {origin?.code || 'YYZ'} <ArrowRight className="icon-inline" /> {(dest || heroDests[0])?.airport.code}
              </span>
              <span className="hero-ticket-meta">
                <span className="live-dot" /> Boarding in 2h 15m
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="container builder-wrap" aria-label="Trip builder">
        <TripBuilder
          ref={summaryRef}
          form={{ ...form, budget: budgetDisplay }}
          setField={setField}
          errors={errors}
          showSummary={showSummary}
          today={today}
          derived={{ days, estUSD, budgetDisplay }}
          onSubmit={onSubmit}
          onSurprise={onSurprise}
          onSample={() => onSample(false)}
        />
      </section>

      <section className="container home-section" aria-labelledby="ideas-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Not sure where?</p>
            <h2 id="ideas-title">Start from a feeling</h2>
          </div>
          <a className="btn btn-ghost" href="#/explore">
            <Compass aria-hidden="true" /> Browse all destinations
          </a>
        </div>
        <ul className="ideas list-plain">
          {IDEAS.map((idea) => (
            <li key={idea.key}>
              <button type="button" className="idea card card-hover" onClick={() => onIdea(idea)}>
                <span className="idea-emoji emoji" aria-hidden="true">
                  {idea.emoji}
                </span>
                <span className="idea-title">{idea.title}</span>
                <span className="idea-text">{idea.text}</span>
                <span className="idea-go" aria-hidden="true">
                  <ArrowRight />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="container home-section" aria-labelledby="season-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              Ranked for {origin ? `flights from ${origin.city}` : 'you'} · {formatDate(form.startDate || today, 'month')}
            </p>
            <h2 id="season-title">Where’s good for your dates</h2>
          </div>
        </div>
        <ul className="dest-grid list-plain">
          {featured.map((r) => (
            <li key={r.dest.id}>
              <DestinationCard dest={r.dest} estimate={r.estimate} flightHours={r.flightHours} travelers={1} inSeason={r.dest.bestMonths.includes(month)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="home-how" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">How Lift Off works</p>
              <h2 id="how-title">From “we should go” to gate B12</h2>
            </div>
          </div>
          <ol className="how-steps list-plain">
            <li className="how-step">
              <span className="how-num">1</span>
              <Wand2 aria-hidden="true" className="how-icon" />
              <h3>Say it however you like</h3>
              <p>Type or speak your trip in plain words, or fill in the form. Budget, dates, people, pace — Lift Off handles the rest.</p>
            </li>
            <li className="how-step">
              <span className="how-num">2</span>
              <Route aria-hidden="true" className="how-icon" />
              <h3>Every hour, actually planned</h3>
              <p>Flights, a bnb and a day-by-day plan that respects opening hours, meal times, travel between stops and jet lag.</p>
            </li>
            <li className="how-step">
              <span className="how-num">3</span>
              <Radio aria-hidden="true" className="how-icon" />
              <h3>It keeps up as you go</h3>
              <p>The live dashboard counts down to your flight, tracks it in the air and tells you when to leave for the next stop.</p>
            </li>
          </ol>
          <ul className="feature-strip list-plain">
            <li>
              <Gauge aria-hidden="true" /> <strong>Smart sort</strong> reorders a day to cut travel and avoid closed doors
            </li>
            <li>
              <Wallet aria-hidden="true" /> <strong>Fit to budget</strong> finds the least painful savings
            </li>
            <li>
              <ListChecks aria-hidden="true" /> <strong>Packing list</strong> built from the forecast and your plans
            </li>
            <li>
              <BellRing aria-hidden="true" /> <strong>Spoken alerts</strong>, big text, dyslexia-friendly fonts and more
            </li>
          </ul>
          <div className="how-cta">
            <button type="button" className="btn btn-dark btn-lg" onClick={() => onSample(true)}>
              <Clock aria-hidden="true" /> Try the live demo
            </button>
            <p className="muted small">Plans a sample trip and opens the live dashboard with the time machine switched on.</p>
          </div>
        </div>
      </section>

      {planning && <PlanningOverlay dest={planning.dest} steps={planning.steps} onDone={finishPlanning} />}
    </div>
  )
}
