import { forwardRef, useMemo } from 'react'
import { AlertTriangle, CalendarDays, Coins, MapPin, PlaneTakeoff, Shuffle, Sparkles, Users } from 'lucide-react'
import { CATEGORIES, INTERESTS, PACES } from '../data/categories.js'
import { DESTINATIONS } from '../data/index.js'
import { useFormat } from '../hooks/useFormat.js'
import { CURRENCIES } from '../lib/money.js'
import { airportOptions, flagOf } from '../lib/options.js'
import { addDays } from '../lib/time.js'
import { Combobox } from './Combobox.jsx'
import { ChipGroup, describedBy, Field, Segmented, Stepper } from './ui.jsx'

const FIELD_ORDER = ['origin', 'destination', 'startDate', 'endDate', 'travelers', 'budget', 'interests']
const FIELD_IDS = { origin: 'tb-origin', destination: 'tb-dest', startDate: 'tb-start', endDate: 'tb-end', travelers: 'tb-travelers', budget: 'tb-budget', interests: 'tb-interests' }

export const TripBuilder = forwardRef(function TripBuilder(
  { form, setField, errors, showSummary, today, derived, onSubmit, onSurprise, onSample },
  summaryRef,
) {
  const fmt = useFormat()
  const { days, estUSD, budgetDisplay } = derived

  const originOptions = useMemo(() => airportOptions(), [])

  const destOptions = useMemo(
    () =>
      DESTINATIONS.map((d) => ({
        value: d.id,
        label: d.name,
        sublabel: `${d.country} · ${d.tagline}`,
        keywords: `${d.region} ${d.vibes.join(' ')} ${d.airport.code}`,
        emoji: flagOf(d.countryCode),
        badge: d.airport.code,
      })),
    [],
  )

  const errorList = FIELD_ORDER.filter((k) => errors[k])
  const symbol = CURRENCIES[fmt.currency] ? fmt.money(0).replace(/[\d\s.,]/g, '') || fmt.currency : '$'

  return (
    <form className="builder card" id="plan-form" onSubmit={onSubmit} noValidate aria-labelledby="builder-title">
      <div className="builder-head">
        <div>
          <p className="eyebrow">Step 1 of 1 — honestly, that’s it</p>
          <h2 id="builder-title">Build your trip</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSample}>
          <Sparkles aria-hidden="true" /> See a sample trip
        </button>
      </div>

      {showSummary && errorList.length > 0 && (
        <div className="callout callout-danger builder-errors" ref={summaryRef} tabIndex={-1} role="alert">
          <AlertTriangle aria-hidden="true" />
          <div className="callout-body">
            <p className="callout-title">
              {errorList.length === 1 ? 'One thing needs a look' : `${errorList.length} things need a look`} before we can plan:
            </p>
            <ul>
              {errorList.map((k) => (
                <li key={k}>
                  <a href={`#${FIELD_IDS[k]}`} onClick={(e) => {
                    e.preventDefault()
                    document.getElementById(FIELD_IDS[k])?.focus()
                  }}>
                    {errors[k]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="builder-grid">
        <div className="builder-route">
          <Combobox id="tb-origin" label="Leaving from" icon={PlaneTakeoff} options={originOptions} value={form.origin} onChange={(v) => setField({ origin: v })} placeholder="City or airport code" error={errors.origin} />
          <Combobox
            id="tb-dest"
            label="Going to"
            icon={MapPin}
            options={destOptions}
            value={form.destination}
            onChange={(v) => setField({ destination: v })}
            placeholder="Pick a destination…"
            error={errors.destination}
            emptyText="We don’t have that one yet — try Explore for ideas"
            action={
              <button type="button" className="btn btn-sm btn-secondary surprise-btn" onClick={onSurprise} title="Pick a destination for me">
                <Shuffle aria-hidden="true" />
                <span>Surprise me</span>
              </button>
            }
          />
        </div>

        <div className="builder-dates">
          <Field id="tb-start" label="Depart" icon={CalendarDays} error={errors.startDate}>
            <input
              id="tb-start"
              className="input"
              type="date"
              min={today}
              value={form.startDate}
              aria-invalid={Boolean(errors.startDate) || undefined}
              aria-describedby={describedBy('tb-start', { error: errors.startDate })}
              onChange={(e) => setField({ startDate: e.target.value })}
            />
          </Field>
          <Field id="tb-end" label="Return" icon={CalendarDays} error={errors.endDate} hint={days > 1 && !errors.endDate ? `${days} days · ${days - 1} night${days === 2 ? '' : 's'}` : undefined}>
            <input
              id="tb-end"
              className="input"
              type="date"
              min={form.startDate ? addDays(form.startDate, 1) : today}
              value={form.endDate}
              aria-invalid={Boolean(errors.endDate) || undefined}
              aria-describedby={describedBy('tb-end', { error: errors.endDate, hint: days > 1 })}
              onChange={(e) => setField({ endDate: e.target.value })}
            />
          </Field>
          <div className="field">
            <span className="label" id="tb-travelers-label">
              <Users aria-hidden="true" /> Travellers
            </span>
            <Stepper id="tb-travelers" value={form.travelers} min={1} max={6} onChange={(v) => setField({ travelers: v })} label="Travellers" unit="travellers" />
          </div>
        </div>

        <div className="builder-budget">
          <Field
            id="tb-budget"
            label={`Total budget (${fmt.currency})`}
            icon={Coins}
            error={errors.budget}
            hint={
              estUSD
                ? `${form.budgetTouched ? 'A comfortable trip like this runs about' : 'Suggested from typical prices:'} ${fmt.money(estUSD)} for ${form.travelers} ${form.travelers === 1 ? 'person' : 'people'}, flights included.`
                : 'Flights, stay, food and activities — for everyone.'
            }
          >
            <div className="input-group">
              <span className="input-prefix-text" aria-hidden="true">
                {symbol}
              </span>
              <input
                id="tb-budget"
                className="input budget-input"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={budgetDisplay}
                aria-invalid={Boolean(errors.budget) || undefined}
                aria-describedby={describedBy('tb-budget', { error: errors.budget, hint: true })}
                onChange={(e) => setField({ budget: e.target.value === '' ? '' : Number(e.target.value), budgetTouched: true })}
              />
              {form.budgetTouched && estUSD && (
                <button type="button" className="btn btn-ghost btn-sm input-suffix" onClick={() => setField({ budgetTouched: false })}>
                  Use suggested
                </button>
              )}
            </div>
          </Field>
          <Segmented
            name="tb-pace"
            legend="Pace"
            value={form.pace}
            onChange={(v) => setField({ pace: v })}
            block
            options={Object.entries(PACES).map(([value, p]) => ({ value, label: p.label, emoji: p.emoji, title: p.blurb }))}
          />
        </div>

        <div className="builder-interests" id="tb-interests" tabIndex={-1}>
          <ChipGroup
            legend="What do you enjoy?"
            name="tb-int"
            values={form.interests}
            onChange={(v) => setField({ interests: v })}
            options={INTERESTS.map((k) => ({ value: k, label: CATEGORIES[k].label, emoji: CATEGORIES[k].emoji }))}
          />
          {errors.interests && <p className="field-error">{errors.interests}</p>}
        </div>
      </div>

      <div className="builder-foot">
        <label className="check">
          <input type="checkbox" checked={form.mobility === 'low-walking'} onChange={(e) => setField({ mobility: e.target.checked ? 'low-walking' : 'standard' })} />
          <span>
            <strong>Less walking, please</strong>
            <span className="hint" style={{ display: 'block' }}>
              Shorter walks, more taxis and transit, step-free stays preferred.
            </span>
          </span>
        </label>
        <button id="plan-submit" type="submit" className="btn btn-primary btn-lg builder-submit">
          <PlaneTakeoff aria-hidden="true" /> Plan my trip
        </button>
      </div>
    </form>
  )
})
