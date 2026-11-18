import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useSettings } from '../context/SettingsContext.jsx'
import { Poster } from './Poster.jsx'

/** A short, honest "here's what we're doing" moment between the form and the plan. */
export function PlanningOverlay({ dest, steps, onDone }) {
  const { reduceMotion } = useSettings()
  const [done, setDone] = useState(0)
  const stepMs = reduceMotion ? 90 : 290

  useEffect(() => {
    if (done >= steps.length) {
      const t = setTimeout(onDone, reduceMotion ? 80 : 260)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setDone((d) => d + 1), stepMs)
    return () => clearTimeout(t)
  }, [done, steps.length, stepMs, onDone, reduceMotion])

  return (
    <div className="planning" role="alertdialog" aria-modal="true" aria-labelledby="planning-title" aria-describedby="planning-steps">
      <div className="planning-card card">
        <Poster dest={dest} ratio="wide" className="planning-poster" />
        <div className="planning-body">
          <p className="eyebrow">Building your trip</p>
          <h2 id="planning-title">
            Packing {dest.name} into a plan<span className="planning-dots" aria-hidden="true" />
          </h2>
          <ol id="planning-steps" className="planning-steps list-plain" aria-live="polite">
            {steps.map((s, i) => (
              <li key={s} className={i < done ? 'is-done' : i === done ? 'is-active' : ''}>
                <span className="planning-tick" aria-hidden="true">
                  {i < done ? <Check /> : null}
                </span>
                <span>{s}</span>
                {i < done && <span className="sr-only"> — done</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
