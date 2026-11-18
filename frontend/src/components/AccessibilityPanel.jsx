import { AArrowDown, AArrowUp, Clock, Coins, Contrast, Eye, Home, Palette, PlayCircle, RotateCcw, Smile, Sparkles, Type, Volume2 } from 'lucide-react'
import { useMemo } from 'react'
import { useSettings } from '../context/SettingsContext.jsx'
import { AIRPORTS } from '../data/index.js'
import { ORIGIN_AIRPORTS } from '../data/airports.js'
import { CATEGORIES } from '../data/categories.js'
import { useSpeech, useVoices } from '../hooks/useSpeech.js'
import { CURRENCIES, CURRENCY_CODES } from '../lib/money.js'
import { Combobox } from './Combobox.jsx'
import { Dialog } from './Dialog.jsx'
import { Glyph, Segmented, Switch } from './ui.jsx'

const FONT_OPTIONS = [
  { value: 'default', label: 'Lift Off', family: "'DM Sans Variable', sans-serif" },
  { value: 'hyperlegible', label: 'Hyperlegible', family: "'Atkinson Hyperlegible', sans-serif" },
  { value: 'dyslexic', label: 'OpenDyslexic', family: "'OpenDyslexic', sans-serif" },
  { value: 'system', label: 'System', family: 'system-ui, sans-serif' },
]

export function AccessibilityPanel({ open, onClose }) {
  const { settings, update, reset } = useSettings()
  const voices = useVoices()
  const { speak, supported } = useSpeech('a11y-test')
  const set = (key) => (value) => update({ [key]: value })

  const voiceOptions = useMemo(() => {
    const lang = (navigator.language || 'en').slice(0, 2)
    return [...voices].sort((a, b) => Number(b.lang.startsWith(lang)) - Number(a.lang.startsWith(lang)) || a.name.localeCompare(b.name))
  }, [voices])

  const airportOptions = useMemo(() => {
    const origins = new Set(ORIGIN_AIRPORTS.map((a) => a.code))
    return AIRPORTS.filter((a) => origins.has(a.code)).map((a) => ({ value: a.code, label: `${a.city} (${a.code})`, sublabel: `${a.name}, ${a.country}`, badge: a.code }))
  }, [])

  const pct = Math.round(settings.textScale * 100)
  const scale = (v) => update({ textScale: Math.round(Math.max(0.85, Math.min(1.6, v)) * 100) / 100 })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Make it yours"
      title="Display & accessibility"
      description="Changes apply instantly and are saved on this device."
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Reset all
          </button>
          <button type="button" className="btn btn-dark" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="a11y-preview card" aria-hidden="true">
        <span className="a11y-preview-time mono">1:30 PM</span>
        <div>
          <p className="a11y-preview-title">Lunch at the market hall</p>
          <p className="muted small">
            <Glyph emoji={CATEGORIES.food.emoji} label={CATEGORIES.food.label} /> · 12 min walk · <a href="#preview" tabIndex={-1} onClick={(e) => e.preventDefault()}>See menu</a>
          </p>
        </div>
        <span className="a11y-swatches">
          {Object.keys(CATEGORIES).map((c) => (
            <span key={c} className="dot" style={{ '--c': `var(--cat-${c})` }} />
          ))}
        </span>
      </div>

      <h3 className="setting-group-title">Reading</h3>
      <div className="setting">
        <div className="spread">
          <label className="setting-title" htmlFor="a11y-size">
            <Type aria-hidden="true" /> Text size
          </label>
          <span className="badge mono">{pct}%</span>
        </div>
        <div className="row" style={{ '--row-gap': '0.6rem', flexWrap: 'nowrap' }}>
          <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => scale(settings.textScale - 0.1)} aria-label="Smaller text">
            <AArrowDown aria-hidden="true" />
          </button>
          <input id="a11y-size" className="range" type="range" min={0.85} max={1.6} step={0.05} value={settings.textScale} onChange={(e) => scale(Number(e.target.value))} aria-valuetext={`${pct}%`} />
          <button type="button" className="btn btn-secondary btn-icon btn-sm" onClick={() => scale(settings.textScale + 0.1)} aria-label="Larger text">
            <AArrowUp aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="setting">
        <fieldset className="fieldset">
          <legend className="setting-title">
            <Sparkles aria-hidden="true" /> Font
          </legend>
          <div className="segmented segmented-block a11y-fonts">
            {FONT_OPTIONS.map((o) => (
              <label key={o.value} style={{ fontFamily: o.family }}>
                <input type="radio" name="a11y-font" checked={settings.font === o.value} onChange={() => update({ font: o.value })} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Segmented
          name="a11y-line"
          legend="Line spacing"
          value={settings.lineSpacing}
          onChange={set('lineSpacing')}
          block
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'relaxed', label: 'Relaxed' },
            { value: 'loose', label: 'Loose' },
          ]}
        />
        <Segmented
          name="a11y-letters"
          legend="Letter spacing"
          value={settings.letterSpacing}
          onChange={set('letterSpacing')}
          block
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'wide', label: 'Wide' },
          ]}
        />
        <Switch id="a11y-links" label="Always underline links" checked={settings.underlineLinks} onChange={set('underlineLinks')} />
      </div>

      <h3 className="setting-group-title">Colour & motion</h3>
      <div className="setting">
        <Segmented
          name="a11y-theme"
          legend={
            <span className="setting-title">
              <Contrast aria-hidden="true" /> Theme
            </span>
          }
          value={settings.theme}
          onChange={set('theme')}
          block
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'contrast', label: 'High contrast' },
          ]}
        />
      </div>
      <div className="setting">
        <Segmented
          name="a11y-palette"
          legend={
            <span className="setting-title">
              <Palette aria-hidden="true" /> Category colours
            </span>
          }
          value={settings.palette}
          onChange={set('palette')}
          block
          options={[
            { value: 'vivid', label: 'Vivid' },
            { value: 'cb', label: 'Colour-blind safe' },
            { value: 'mono', label: 'Monochrome' },
          ]}
        />
        <p className="hint">Colour is never the only signal — every category also has an icon and a label.</p>
      </div>
      <div className="setting">
        <Segmented
          name="a11y-icons"
          legend={
            <span className="setting-title">
              <Smile aria-hidden="true" /> Icons & labels
            </span>
          }
          value={settings.iconMode}
          onChange={set('iconMode')}
          block
          options={[
            { value: 'both', label: '🍽️ Food' },
            { value: 'emoji', label: '🍽️ only' },
            { value: 'text', label: 'Text only' },
          ]}
        />
      </div>
      <div className="setting">
        <Segmented
          name="a11y-motion"
          legend={
            <span className="setting-title">
              <Eye aria-hidden="true" /> Motion
            </span>
          }
          value={settings.motion}
          onChange={set('motion')}
          block
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'reduce', label: 'Reduce' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </div>

      <h3 className="setting-group-title">Read aloud</h3>
      <div className="setting">
        {!supported && <p className="hint">Your browser doesn’t support text-to-speech.</p>}
        <Switch id="a11y-tts" label="Show “Read aloud” buttons" description="Hear your itinerary, flights and live updates." checked={settings.tts && supported} onChange={set('tts')} />
        <Switch id="a11y-alerts" label="Speak live alerts" description="Announces “time to leave” moments on the live dashboard." checked={settings.speakAlerts} onChange={set('speakAlerts')} />
        {supported && settings.tts && (
          <>
            <div className="field">
              <label className="label" htmlFor="a11y-voice">
                <Volume2 aria-hidden="true" /> Voice
              </label>
              <select id="a11y-voice" className="select" value={settings.ttsVoice} onChange={(e) => update({ ttsVoice: e.target.value })}>
                <option value="">System default</option>
                {voiceOptions.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <div className="spread">
                <label className="label" htmlFor="a11y-rate">
                  Speed
                </label>
                <span className="badge mono">{settings.ttsRate.toFixed(1)}×</span>
              </div>
              <input id="a11y-rate" className="range" type="range" min={0.6} max={1.6} step={0.1} value={settings.ttsRate} onChange={(e) => update({ ttsRate: Number(e.target.value) })} />
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => speak('Hi! This is how Lift Off will read your plans. Your flight to Lisbon leaves in 3 days.', 'a11y-test')}>
              <PlayCircle aria-hidden="true" /> Test the voice
            </button>
          </>
        )}
      </div>

      <h3 className="setting-group-title">Regional</h3>
      <div className="setting">
        <Segmented
          name="a11y-clock"
          legend={
            <span className="setting-title">
              <Clock aria-hidden="true" /> Clock
            </span>
          }
          value={settings.hour12 ? '12' : '24'}
          onChange={(v) => update({ hour12: v === '12' })}
          block
          options={[
            { value: '12', label: '1:30 PM' },
            { value: '24', label: '13:30' },
          ]}
        />
        <div className="field">
          <label className="label" htmlFor="a11y-currency">
            <Coins aria-hidden="true" /> Show prices in
          </label>
          <select id="a11y-currency" className="select" value={settings.currency} onChange={(e) => update({ currency: e.target.value })}>
            {CURRENCY_CODES.map((c) => (
              <option key={c} value={c}>
                {c} — {CURRENCIES[c].label}
              </option>
            ))}
          </select>
        </div>
        <Combobox id="a11y-home" label="Home airport" icon={Home} options={airportOptions} value={settings.homeAirport} onChange={(v) => update({ homeAirport: v })} placeholder="Search city or code" />
      </div>
    </Dialog>
  )
}
