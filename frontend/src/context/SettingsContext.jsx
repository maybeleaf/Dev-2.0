import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { TIMEZONE_TO_ORIGIN } from '../data/airports.js'
import { readJSON, writeJSON } from '../lib/storage.js'
import { userTimeZone } from '../lib/time.js'

const KEY = 'liftoff:settings:v1'

const guessHour12 = () => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true
  } catch {
    return true
  }
}

const guessCurrency = () => {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
  if (/-CA$/i.test(lang)) return 'CAD'
  if (/-GB$/i.test(lang)) return 'GBP'
  if (/-AU$/i.test(lang)) return 'AUD'
  if (/-IN$/i.test(lang)) return 'INR'
  if (/-PK$/i.test(lang)) return 'PKR'
  if (/^(de|fr|es|it|pt|nl)/i.test(lang) && !/-(BR|MX|US)$/i.test(lang)) return 'EUR'
  return 'USD'
}

const DEFAULT_SETTINGS = {
  theme: 'system', // light | dark | contrast | system
  textScale: 1,
  font: 'default', // default | hyperlegible | dyslexic | system
  lineSpacing: 'normal', // normal | relaxed | loose
  letterSpacing: 'normal', // normal | wide
  palette: 'vivid', // vivid | cb | mono
  iconMode: 'both', // both | emoji | text
  motion: 'system', // system | reduce | full
  underlineLinks: false,
  tts: true,
  ttsRate: 1,
  ttsVoice: '',
  speakAlerts: false,
  hour12: true,
  currency: 'USD',
  homeAirport: 'YYZ',
}

const SettingsContext = createContext(null)

function useMedia(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia?.(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia?.(query)
    if (!mq) return undefined
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return Boolean(match)
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    hour12: guessHour12(),
    currency: guessCurrency(),
    homeAirport: TIMEZONE_TO_ORIGIN[userTimeZone()] || 'YYZ',
    ...readJSON(KEY, {}),
  }))
  const systemDark = useMedia('(prefers-color-scheme: dark)')
  const systemReduce = useMedia('(prefers-reduced-motion: reduce)')
  const systemContrast = useMedia('(prefers-contrast: more)')

  useEffect(() => {
    writeJSON(KEY, settings)
  }, [settings])

  const resolvedTheme = settings.theme === 'system' ? (systemContrast ? 'contrast' : systemDark ? 'dark' : 'light') : settings.theme
  const reduceMotion = settings.motion === 'reduce' || (settings.motion === 'system' && systemReduce)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.dataset.font = settings.font
    root.dataset.palette = settings.palette
    root.dataset.spacing = settings.lineSpacing
    root.dataset.letters = settings.letterSpacing
    root.dataset.motion = reduceMotion ? 'reduce' : 'full'
    root.dataset.links = settings.underlineLinks ? 'underline' : 'auto'
    root.dataset.icons = settings.iconMode
    root.style.setProperty('--text-scale', String(settings.textScale))
    root.style.colorScheme = resolvedTheme === 'light' ? 'light' : 'dark'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolvedTheme === 'light' ? '#f7f3ea' : resolvedTheme === 'dark' ? '#101613' : '#000000')
  }, [settings, resolvedTheme, reduceMotion])

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), [])
  const reset = useCallback(
    () => setSettings((s) => ({ ...DEFAULT_SETTINGS, hour12: guessHour12(), currency: s.currency, homeAirport: s.homeAirport })),
    [],
  )

  const value = useMemo(() => ({ settings, update, reset, resolvedTheme, reduceMotion }), [settings, update, reset, resolvedTheme, reduceMotion])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>')
  return ctx
}
