import { countdownParts, describeCountdown } from '../lib/time.js'

/**
 * Departure-board countdown. Each digit is keyed by its value, so it re-mounts
 * (and plays the flip) only when it changes. Screen readers get one plain
 * sentence via the timer's label instead of a stream of digits.
 */
export function SplitFlap({ ms, label, size = '' }) {
  const { days, hours, minutes, seconds } = countdownParts(ms)
  const units =
    days > 0
      ? [
          [days, days === 1 ? 'day' : 'days'],
          [hours, 'hrs'],
          [minutes, 'min'],
          [seconds, 'sec'],
        ]
      : [
          [hours, 'hrs'],
          [minutes, 'min'],
          [seconds, 'sec'],
        ]
  return (
    <div className={`flap ${size ? `flap-${size}` : ''}`} role="timer" aria-label={`${label}: ${describeCountdown(ms) || 'now'}`}>
      {units.map(([value, unit]) => (
        <div key={unit} className="flap-unit" aria-hidden="true">
          <span className="flap-digits">
            {String(value)
              .padStart(2, '0')
              .split('')
              .map((ch, i) => (
                <span key={`${i}:${ch}`} className="flap-digit">
                  {ch}
                </span>
              ))}
          </span>
          <span className="flap-label">{unit}</span>
        </div>
      ))}
    </div>
  )
}
