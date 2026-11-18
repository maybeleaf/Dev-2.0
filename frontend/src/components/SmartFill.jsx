import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Mic, MicOff, Sparkles } from 'lucide-react'

const EXAMPLES = [
  'A relaxed week in Tokyo for two in April, under $6k — we love food and museums',
  'Long weekend somewhere warm from Toronto under $1500',
  'Family of 4 to Sydney in December, less walking please',
  'Solo foodie trip to Istanbul next month, packed',
]

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/**
 * "Describe your trip" → the form fills itself in. Rule-based parsing (no API key,
 * no network), and it shows exactly what it understood as chips.
 */
export function SmartFill({ onApply }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  useEffect(() => () => recRef.current?.abort?.(), [])

  const run = (value) => {
    const v = value.trim()
    if (!v) return
    setResult(onApply(v))
  }

  const listen = () => {
    if (!Recognition) return
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new Recognition()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
      setText(transcript)
      if (e.results[e.results.length - 1].isFinal) run(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  return (
    <div className="smart">
      <form
        className="smart-form"
        onSubmit={(e) => {
          e.preventDefault()
          run(text)
        }}
      >
        <label htmlFor="smart-input" className="sr-only">
          Describe your trip in your own words
        </label>
        <Sparkles aria-hidden="true" className="smart-icon" />
        <input
          id="smart-input"
          className="smart-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe your trip… “a week in Lisbon in May for two, under $4k”"
          autoComplete="off"
          aria-describedby="smart-help"
        />
        {Recognition && (
          <button type="button" className={`btn btn-ghost btn-icon smart-mic ${listening ? 'is-listening' : ''}`} onClick={listen} aria-pressed={listening} aria-label={listening ? 'Stop listening' : 'Describe your trip by voice'}>
            {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
          </button>
        )}
        <button type="submit" className="btn btn-primary smart-go">
          <span>Fill it in</span>
          <ArrowRight aria-hidden="true" />
        </button>
      </form>
      <p id="smart-help" className="sr-only">
        Mention a place, where you’re leaving from, dates or trip length, budget, how many people, and what you enjoy. The trip form below fills in automatically.
      </p>

      <div aria-live="polite">
        {result && result.chips.length > 0 && (
          <div className="smart-result fade-up">
            <span className="smart-result-label">Got it:</span>
            <ul className="chip-row list-plain">
              {result.chips.map((c) => (
                <li key={c.key} className="chip chip-static smart-chip">
                  <span className="emoji" aria-hidden="true">
                    {c.emoji}
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
            <a className="smart-jump" href="#plan-form" onClick={(e) => {
              e.preventDefault()
              document.getElementById('plan-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              document.getElementById('plan-submit')?.focus({ preventScroll: true })
            }}>
              Review & plan <ArrowRight aria-hidden="true" className="icon-inline" />
            </a>
          </div>
        )}
        {result && result.chips.length === 0 && <p className="smart-result muted small">I couldn’t spot any details — try a place, dates or a budget, like the examples below.</p>}
      </div>

      <div className="smart-examples">
        <span className="small muted">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="smart-example"
            onClick={() => {
              setText(ex)
              run(ex)
            }}
          >
            “{ex}”
          </button>
        ))}
      </div>
    </div>
  )
}
