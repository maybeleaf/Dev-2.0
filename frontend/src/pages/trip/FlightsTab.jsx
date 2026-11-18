import { useMemo, useState } from 'react'
import { PlaneLanding, PlaneTakeoff } from 'lucide-react'
import { BoardingPass } from '../../components/BoardingPass.jsx'
import { SpeakButton } from '../../components/SpeakButton.jsx'
import { Segmented, Switch } from '../../components/ui.jsx'
import { selectFlight } from '../../engine/edit.js'
import { flightInconvenience } from '../../engine/flights.js'
import { useFormat } from '../../hooks/useFormat.js'
import { describeFlight } from '../../lib/describe.js'
import { epochToZoned, formatDate } from '../../lib/time.js'

const SORTS = {
  best: (a, b) => Number(b.tags.includes('best')) - Number(a.tags.includes('best')) || a.price + flightInconvenience(a) * 80 + a.durationMin * 0.6 - (b.price + flightInconvenience(b) * 80 + b.durationMin * 0.6),
  cheapest: (a, b) => a.price - b.price,
  fastest: (a, b) => a.durationMin - b.durationMin,
  earliest: (a, b) => a.depart - b.depart,
}

function FlightList({ title, icon: Icon, list, selectedId, onPick, fmt, travelers, idPrefix }) {
  const [sort, setSort] = useState('best')
  const [nonstop, setNonstop] = useState(false)
  const selected = list.find((f) => f.id === selectedId)
  const shown = useMemo(() => list.filter((f) => !nonstop || f.stops === 0 || f.id === selectedId).sort(SORTS[sort]), [list, sort, nonstop, selectedId])
  const anyNonstop = list.some((f) => f.stops === 0)
  const date = epochToZoned(list[0].depart, list[0].from.timezone).date
  return (
    <section className="flight-section" aria-labelledby={`${idPrefix}-title`}>
      <div className="flight-head">
        <div>
          <p className="eyebrow">
            <Icon aria-hidden="true" className="icon-inline" /> {formatDate(date, 'long')}
          </p>
          <h2 id={`${idPrefix}-title`}>{title}</h2>
          <p className="muted small">
            {list[0].from.city} ({list[0].from.code}) → {list[0].to.city} ({list[0].to.code}) · {list.length} options · times are local
          </p>
        </div>
        <div className="flight-tools">
          <Segmented
            name={`${idPrefix}-sort`}
            legend="Sort flights"
            hideLegend
            value={sort}
            onChange={setSort}
            options={[
              { value: 'best', label: 'Best' },
              { value: 'cheapest', label: 'Cheapest' },
              { value: 'fastest', label: 'Fastest' },
              { value: 'earliest', label: 'Earliest' },
            ]}
          />
          {anyNonstop && <Switch id={`${idPrefix}-nonstop`} label="Nonstop only" checked={nonstop} onChange={setNonstop} />}
        </div>
      </div>
      <ul className="flight-list list-plain">
        {shown.map((f) => (
          <li key={f.id}>
            <BoardingPass flight={f} fmt={fmt} travelers={travelers} selected={f.id === selectedId} priceDelta={selected ? (f.price - selected.price) * travelers : null} onSelect={() => onPick(f)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FlightsTab({ view }) {
  const { trip, dest, ctx, apply } = view
  const fmt = useFormat()
  const travelers = trip.params.travelers
  const pick = (direction) => (f) =>
    apply((t) => selectFlight(t, dest, direction, f.id), {
      title: `Switched to ${f.airline.name} ${f.flightNo}`,
      body: 'Your first and last days were adjusted to the new times.',
      emoji: '✈️',
    })
  return (
    <div className="flights stack" style={{ '--stack-gap': '2.5rem' }}>
      <div className="row">
        <p className="muted small" style={{ flex: 1 }}>
          Mock fares from fictional airlines — realistic routes, times and time zones, but nothing here can be booked.
        </p>
        <SpeakButton text={() => `${describeFlight(ctx.outbound, fmt, 'Your outbound flight')} ${describeFlight(ctx.inbound, fmt, 'Your return flight')}`} label="Read my flights" />
      </div>
      <FlightList title="Getting there" icon={PlaneTakeoff} idPrefix="out" list={trip.flights.outbound} selectedId={ctx.outbound.id} onPick={pick('outbound')} fmt={fmt} travelers={travelers} />
      <FlightList title="Coming home" icon={PlaneLanding} idPrefix="ret" list={trip.flights.inbound} selectedId={ctx.inbound.id} onPick={pick('inbound')} fmt={fmt} travelers={travelers} />
    </div>
  )
}
