import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { SpeakButton } from '../../components/SpeakButton.jsx'
import { Emoji, Progress } from '../../components/ui.jsx'
import { setChecklist } from '../../engine/edit.js'
import { buildChecklist } from '../../engine/packing.js'

export function ChecklistTab({ view, weather }) {
  const { trip, dest, schedules, apply } = view
  const groups = useMemo(() => buildChecklist(trip, dest, { weather: weather.days, schedules }), [trip, dest, weather.days, schedules])
  const all = groups.flatMap((g) => g.items)
  const done = all.filter((i) => trip.checklist?.[i.key]).length
  const allDone = done === all.length && all.length > 0
  const remaining = all.filter((i) => !trip.checklist?.[i.key])

  return (
    <div className="checklist stack" style={{ '--stack-gap': '1.5rem' }}>
      <div className="card card-pad checklist-head">
        <div className="stack" style={{ '--stack-gap': '0.5rem', flex: 1 }}>
          <p className="eyebrow">Built from your forecast and your plans</p>
          <h2>
            {allDone ? (
              <>
                All set — bon voyage! <Emoji>🎉</Emoji>
              </>
            ) : (
              `${done} of ${all.length} ready`
            )}
          </h2>
          <Progress value={all.length ? done / all.length : 0} tone={allDone ? 'success' : undefined} label="Checklist progress" valueText={`${done} of ${all.length} done`} />
        </div>
        <div className="row">
          <SpeakButton text={() => (remaining.length ? `Still to do: ${remaining.map((i) => i.label).join('. ')}.` : 'Everything is checked off. Have a great trip!')} label="Read what’s left" />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer aria-hidden="true" /> Print
          </button>
        </div>
      </div>
      <div className="checklist-grid">
        {groups.map((g) => {
          const gd = g.items.filter((i) => trip.checklist?.[i.key]).length
          return (
            <fieldset key={g.key} className="card card-pad checklist-group fieldset">
              <legend className="checklist-legend">
                <Emoji>{g.emoji}</Emoji> {g.label}{' '}
                <span className="muted small">
                  {gd}/{g.items.length}
                </span>
              </legend>
              <ul className="list-plain stack" style={{ '--stack-gap': '0.65rem' }}>
                {g.items.map((i) => (
                  <li key={i.key}>
                    <label className={`check checklist-item ${trip.checklist?.[i.key] ? 'is-done' : ''}`}>
                      <input type="checkbox" checked={Boolean(trip.checklist?.[i.key])} onChange={(e) => apply((t) => setChecklist(t, i.key, e.target.checked))} />
                      <span>
                        <Emoji>{i.emoji}</Emoji> {i.label}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )
        })}
      </div>
    </div>
  )
}
