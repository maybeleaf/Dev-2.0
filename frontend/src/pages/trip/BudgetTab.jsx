import { useState } from 'react'
import { PiggyBank, Wallet } from 'lucide-react'
import { Donut } from '../../components/Donut.jsx'
import { SpeakButton } from '../../components/SpeakButton.jsx'
import { Emoji, Progress } from '../../components/ui.jsx'
import { BUDGET_COLORS } from '../../data/categories.js'
import { useFormat } from '../../hooks/useFormat.js'
import { fromUSD, toUSD } from '../../lib/money.js'
import { formatDate } from '../../lib/time.js'

const DAY_PARTS = [
  { key: 'food', label: 'Food' },
  { key: 'activities', label: 'Activities' },
  { key: 'transport', label: 'Getting around' },
  { key: 'extras', label: 'Coffee & extras' },
]

export function BudgetTab({ view, onFit }) {
  const { trip, budget, apply } = view
  const fmt = useFormat()
  const [draft, setDraft] = useState(() => String(Math.round(fromUSD(trip.params.budgetUSD, fmt.currency))))
  const b = budget
  const maxDay = Math.max(1, ...b.byDay.map((d) => d.total))
  const tone = b.status === 'over' ? 'danger' : b.status === 'close' ? 'warning' : 'success'
  const draftUSD = toUSD(Number(draft) || 0, fmt.currency)
  const dirty = Number(draft) > 0 && Math.abs(draftUSD - trip.params.budgetUSD) > 1

  const speech = () =>
    `Your trip is estimated at ${fmt.money(b.total)}, against a budget of ${fmt.money(b.budget)}. ${b.remaining >= 0 ? `That leaves ${fmt.money(b.remaining)} spare.` : `That's ${fmt.money(-b.remaining)} over.`} ` +
    b.lines.map((l) => `${l.label}: ${fmt.money(l.amount)}.`).join(' ')

  return (
    <div className="budget stack" style={{ '--stack-gap': '1.5rem' }}>
      <section className="budget-top card card-pad" aria-labelledby="budget-title">
        <div className="budget-summary">
          <div className="stack" style={{ '--stack-gap': '0.5rem' }}>
            <p className="eyebrow">Estimated total</p>
            <h2 id="budget-title" className="budget-total num">
              {fmt.money(b.total)} <span className="budget-of">of {fmt.money(b.budget)}</span>
            </h2>
            <Progress value={b.usedPct} tone={tone} size="lg" label="Budget used" valueText={`${Math.round(b.usedPct * 100)}% of budget`} />
            <p className={`budget-status is-${b.status}`}>
              {b.status === 'over' ? (
                <>
                  <Emoji>⚠️</Emoji> {fmt.money(-b.remaining)} over budget
                </>
              ) : (
                <>
                  <Emoji>{b.status === 'close' ? '🤏' : '🎉'}</Emoji> {fmt.money(b.remaining)} to spare{b.status === 'close' ? ' — cutting it close' : ''}
                </>
              )}
            </p>
            <div className="row">
              {b.status === 'over' && (
                <button type="button" className="btn btn-primary" onClick={onFit}>
                  <PiggyBank aria-hidden="true" /> Fit to budget
                </button>
              )}
              <SpeakButton text={speech} label="Read budget" />
            </div>
          </div>
          <dl className="budget-stats">
            <div>
              <dt>Per person</dt>
              <dd className="num">{fmt.money(b.perPerson)}</dd>
            </div>
            <div>
              <dt>Per day</dt>
              <dd className="num">{fmt.money(b.perDay)}</dd>
            </div>
            <div>
              <dt>Nights</dt>
              <dd className="num">{b.nights}</dd>
            </div>
          </dl>
        </div>

        <form
          className="budget-edit"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dirty) return
            apply((t) => ({ ...t, params: { ...t.params, budgetUSD: Math.round(draftUSD) }, updatedAt: Date.now() }), { title: 'Budget updated', body: `Now ${fmt.money(draftUSD)}.`, emoji: '💰' })
          }}
        >
          <label className="label" htmlFor="budget-input">
            <Wallet aria-hidden="true" /> Change budget ({fmt.currency})
          </label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="budget-input" className="input num" type="number" inputMode="numeric" min={0} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="btn btn-dark" disabled={!dirty}>
              Update
            </button>
          </div>
        </form>
      </section>

      <div className="budget-grid">
        <section className="card card-pad budget-breakdown" aria-labelledby="breakdown-title">
          <h2 id="breakdown-title" className="card-title">
            Where it goes
          </h2>
          <div className="budget-donut-row">
            <Donut lines={b.lines} total={b.total} label={`Budget breakdown: ${b.lines.map((l) => `${l.label} ${fmt.money(l.amount)}`).join(', ')}`}>
              <span className="donut-total num">{fmt.money(b.total, { compact: true })}</span>
              <span className="muted small">total</span>
            </Donut>
            <table className="budget-table">
              <caption className="sr-only">Budget by category</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {b.lines.map((l) => (
                  <tr key={l.key}>
                    <th scope="row">
                      <span className="dot" style={{ '--c': BUDGET_COLORS[l.key] }} aria-hidden="true" /> <Emoji>{l.emoji}</Emoji> {l.label}
                    </th>
                    <td className="num">{fmt.money(l.amount)}</td>
                    <td className="num muted">{b.total ? Math.round((l.amount / b.total) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card card-pad" aria-labelledby="perday-title">
          <h2 id="perday-title" className="card-title">
            Day by day <span className="muted small">(on the ground)</span>
          </h2>
          <ul className="perday list-plain">
            {b.byDay.map((d, i) => (
              <li key={d.date} className="perday-row">
                <span className="perday-label">
                  <strong>Day {i + 1}</strong> <span className="muted small">{formatDate(d.date, 'short')}</span>
                </span>
                <span className="perday-bar" role="img" aria-label={DAY_PARTS.map((p) => `${p.label} ${fmt.money(d[p.key])}`).join(', ')}>
                  {DAY_PARTS.map((p) =>
                    d[p.key] > 0 ? <span key={p.key} style={{ width: `${(d[p.key] / maxDay) * 100}%`, background: BUDGET_COLORS[p.key] }} /> : null,
                  )}
                </span>
                <span className="perday-total num">{fmt.money(d.total)}</span>
              </li>
            ))}
          </ul>
          <ul className="perday-legend list-plain">
            {DAY_PARTS.map((p) => (
              <li key={p.key}>
                <span className="dot" style={{ '--c': BUDGET_COLORS[p.key] }} aria-hidden="true" /> {p.label}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="muted small">All prices are mock estimates, stored in USD and shown in {fmt.currency} at fixed demo rates. Activity and meal prices are per person, multiplied by your group.</p>
    </div>
  )
}
