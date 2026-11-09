import { ArrowRight, CloudSun, Droplets, Plug, Siren, Coins, Languages, Clock } from 'lucide-react'
import { BoardingPass } from '../../components/BoardingPass.jsx'
import { Donut } from '../../components/Donut.jsx'
import { StayArt } from '../../components/StayCard.jsx'
import { Emoji, Glyph, Rating } from '../../components/ui.jsx'
import { BUDGET_COLORS, CATEGORIES, MEALS, WEATHER } from '../../data/categories.js'
import { useFormat } from '../../hooks/useFormat.js'
import { dayTitle } from '../../lib/describe.js'
import { formatDate, tzOffsetMinutes } from '../../lib/time.js'

function timeDiffText(dest, origin, at) {
  if (!origin) return null
  const diff = (tzOffsetMinutes(at, dest.timezone) - tzOffsetMinutes(at, origin.timezone)) / 60
  if (diff === 0) return `Same time zone as ${origin.city}`
  const h = Math.abs(diff)
  const hs = Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`
  return `${dest.name} is ${hs} ${diff > 0 ? 'ahead of' : 'behind'} ${origin.city}`
}

export function OverviewTab({ view, weather, goTo }) {
  const { trip, dest, origin, schedules, budget, ctx } = view
  const fmt = useFormat()
  const source = weather.source === 'open-meteo' ? 'Based on the same dates last year (Open-Meteo, via our API)' : 'Typical weather for the season'

  return (
    <div className="overview">
      <div className="overview-main stack" style={{ '--stack-gap': '1.5rem' }}>
        <section className="card card-pad" aria-labelledby="wx-title">
          <div className="spread">
            <h2 id="wx-title" className="card-title">
              <CloudSun aria-hidden="true" className="icon-inline" /> Weather
            </h2>
            <span className="muted small">{weather.loading ? 'Checking last year’s weather…' : source}</span>
          </div>
          <ul className="wx-strip list-plain">
            {schedules.map((s, i) => {
              const w = weather.days[i]
              if (!w) return null
              return (
                <li key={s.date} className={`wx-day wx-${w.condition}`}>
                  <span className="wx-date">{formatDate(s.date, 'weekday')}</span>
                  <span className="wx-emoji emoji" aria-hidden="true">
                    {WEATHER[w.condition]?.emoji}
                  </span>
                  <span className="sr-only">{WEATHER[w.condition]?.label}</span>
                  <span className="wx-temp num">
                    {w.high}° <span className="muted">{w.low}°</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="days-title" className="stack" style={{ '--stack-gap': '0.85rem' }}>
          <h2 id="days-title" className="card-title">
            Day by day
          </h2>
          <ol className="overview-days list-plain">
            {schedules.map((s, i) => (
              <li key={s.date}>
                <button type="button" className="oday card card-hover" onClick={() => goTo('itinerary', i)}>
                  <span className="oday-n">
                    <span className="oday-num">{i + 1}</span>
                    <span className="small muted">{formatDate(s.date, 'short')}</span>
                  </span>
                  <span className="oday-body">
                    <span className="oday-title">{dayTitle(s)}</span>
                    <span className="oday-stops">
                      {s.stops.slice(0, 5).map((st) => (
                        <span key={st.key} className="oday-stop" style={{ '--c': `var(--cat-${st.act.category})` }}>
                          <Emoji>{st.act.category === 'food' ? MEALS[st.act.meal]?.emoji : CATEGORIES[st.act.category].emoji}</Emoji>
                          <span className="oday-stop-time mono">{fmt.time(st.start, dest.timezone)}</span> {st.act.name}
                        </span>
                      ))}
                      {s.stops.length > 5 && <span className="muted small">+{s.stops.length - 5} more</span>}
                      {s.stops.length === 0 && <span className="muted small">{s.window.departure ? 'Travel day' : 'Free day'}</span>}
                    </span>
                  </span>
                  <span className="oday-meta">
                    {s.issueCount > 0 && <span className="badge badge-warning">{s.issueCount} to fix</span>}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="overview-side stack" style={{ '--stack-gap': '1.25rem' }} aria-label="Trip summary">
        <section className="card card-pad stack" style={{ '--stack-gap': '0.75rem' }} aria-labelledby="ov-flights">
          <div className="spread">
            <h2 id="ov-flights" className="card-title">
              Flights
            </h2>
            <button type="button" className="link-btn" onClick={() => goTo('flights')}>
              Change
            </button>
          </div>
          <BoardingPass flight={ctx.outbound} fmt={fmt} travelers={trip.params.travelers} compact headingLevel={3} />
          <BoardingPass flight={ctx.inbound} fmt={fmt} travelers={trip.params.travelers} compact headingLevel={3} />
        </section>

        <section className="card ov-stay" aria-labelledby="ov-stay">
          <StayArt stay={ctx.stay} dest={dest} />
          <div className="card-pad stack" style={{ '--stack-gap': '0.35rem' }}>
            <div className="spread">
              <h2 id="ov-stay" className="card-title">
                Your stay
              </h2>
              <button type="button" className="link-btn" onClick={() => goTo('stay')}>
                Change
              </button>
            </div>
            <p className="ov-stay-title">{ctx.stay.title}</p>
            <p className="muted small">
              {ctx.stay.type} · {ctx.stay.neighborhood} · host {ctx.stay.host}
            </p>
            <Rating value={ctx.stay.rating} reviews={ctx.stay.reviews} />
          </div>
        </section>

        <section className="card card-pad" aria-labelledby="ov-budget">
          <div className="spread">
            <h2 id="ov-budget" className="card-title">
              Budget
            </h2>
            <button type="button" className="link-btn" onClick={() => goTo('budget')}>
              Details
            </button>
          </div>
          <div className="ov-budget">
            <Donut lines={budget.lines} total={budget.total} size={132} stroke={18} label={`Total ${fmt.money(budget.total)} of ${fmt.money(budget.budget)}`}>
              <span className="num ov-budget-pct">{Math.round(budget.usedPct * 100)}%</span>
            </Donut>
            <div className="stack" style={{ '--stack-gap': '0.3rem' }}>
              <p className="num ov-budget-total">{fmt.money(budget.total)}</p>
              <p className="muted small">of {fmt.money(budget.budget)}</p>
              <p className={`budget-status is-${budget.status} small`}>{budget.remaining >= 0 ? `${fmt.money(budget.remaining)} to spare` : `${fmt.money(-budget.remaining)} over`}</p>
              <ul className="list-plain ov-budget-keys">
                {budget.lines.slice(0, 3).map((l) => (
                  <li key={l.key} className="small">
                    <span className="dot" style={{ '--c': BUDGET_COLORS[l.key] }} aria-hidden="true" /> {l.label} {fmt.money(l.amount, { compact: true })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="card card-pad" aria-labelledby="ov-know">
          <h2 id="ov-know" className="card-title">
            Good to know
          </h2>
          <dl className="facts">
            <div>
              <dt>
                <Clock aria-hidden="true" /> Time
              </dt>
              <dd>{timeDiffText(dest, origin, ctx.outbound.depart)}</dd>
            </div>
            <div>
              <dt>
                <Coins aria-hidden="true" /> Money
              </dt>
              <dd>
                {dest.currency.code} ({dest.currency.symbol}) · {dest.practical.tipping}
              </dd>
            </div>
            <div>
              <dt>
                <Plug aria-hidden="true" /> Power
              </dt>
              <dd>{dest.practical.plug}</dd>
            </div>
            <div>
              <dt>
                <Droplets aria-hidden="true" /> Water
              </dt>
              <dd>{dest.practical.water}</dd>
            </div>
            <div>
              <dt>
                <Languages aria-hidden="true" /> Language
              </dt>
              <dd>{dest.languages.join(', ')}</dd>
            </div>
            <div>
              <dt>
                <Siren aria-hidden="true" /> Emergency
              </dt>
              <dd>
                <Glyph emoji="📞" label={dest.practical.emergency} />
              </dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  )
}
