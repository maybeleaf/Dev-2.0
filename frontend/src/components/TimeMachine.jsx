import { useState } from 'react'
import { ChevronDown, Clock, Pause, RotateCcw } from 'lucide-react'
import { useClock, useNow } from '../context/ClockContext.jsx'

const SPEEDS = [
  { value: 0, label: 'Pause', icon: Pause },
  { value: 1, label: '1×', title: 'Real speed' },
  { value: 60, label: '60×', title: 'One minute per second' },
  { value: 600, label: '10 min/s', title: 'Ten minutes per second' },
  { value: 3600, label: '1 h/s', title: 'One hour per second' },
]

/** Shown on every other page while the clock is simulated, so nobody gets confused by "wrong" times. */
export function ClockBadge({ path }) {
  const { simulated, reset, speed } = useClock()
  if (!simulated || path.startsWith('/live/')) return null
  const label = SPEEDS.find((s) => s.value === speed)?.label || `${speed}×`
  return (
    <div className="clock-badge" role="status">
      <Clock aria-hidden="true" />
      <span>Time machine on{speed === 0 ? ' · paused' : ` · ${label}`}</span>
      <button type="button" className="link-btn" onClick={reset}>
        Real time
      </button>
    </div>
  )
}

/**
 * The demo dock: fast-forward or jump the app's clock so judges (and you) can
 * watch a whole trip play out in a couple of minutes.
 */
export function TimeMachine({ jumps, tz, place, fmt }) {
  const { speed, setSpeed, jumpTo, reset, simulated } = useClock()
  const now = useNow(1000)
  const [open, setOpen] = useState(true)
  const speedLabel = SPEEDS.find((s) => s.value === speed)?.label || `${speed}×`

  if (!open) {
    return (
      <button type="button" className="tm-pill" onClick={() => setOpen(true)} aria-expanded="false" aria-controls="time-machine">
        <Clock aria-hidden="true" /> Time machine{simulated ? ` · ${speedLabel}` : ''}
      </button>
    )
  }

  return (
    <section id="time-machine" className="tm" aria-labelledby="tm-title">
      <div className="tm-head">
        <h2 id="tm-title" className="tm-title">
          <Clock aria-hidden="true" /> Time machine
        </h2>
        <span className={`tm-mode ${simulated ? 'is-sim' : ''}`}>{simulated ? (speed === 0 ? 'Paused' : `Simulated · ${speedLabel}`) : 'Real time'}</span>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Minimise time machine" aria-expanded="true" aria-controls="time-machine">
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      <p className="tm-now">
        <span className="mono">{fmt.time(now, tz)}</span> <span className="muted">{fmt.epochDate(now, tz, 'medium')} in {place}</span>
      </p>
      <div className="segmented tm-speeds" role="group" aria-label="Clock speed">
        {SPEEDS.map(({ value, label, title, icon: Icon }) => (
          <button key={value} type="button" aria-pressed={speed === value} title={title} onClick={() => setSpeed(value)} aria-label={Icon ? label : undefined}>
            {Icon ? <Icon aria-hidden="true" /> : label}
          </button>
        ))}
      </div>
      <div className="tm-jumps" role="group" aria-label="Jump to a moment">
        {jumps.map((j) => (
          <button key={j.key} type="button" className="tm-jump" onClick={() => jumpTo(j.at)}>
            <span className="emoji" aria-hidden="true">
              {j.emoji}
            </span>{' '}
            {j.label}
          </button>
        ))}
      </div>
      {simulated && (
        <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Back to real time
        </button>
      )}
    </section>
  )
}
