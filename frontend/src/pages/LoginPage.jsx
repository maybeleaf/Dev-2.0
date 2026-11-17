import { useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, LogIn, Mail, UserPlus } from 'lucide-react'
import { Logo } from '../components/Logo.jsx'
import { Field, describedBy } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { usePageTitle } from '../hooks/usePageTitle.js'
import { href, navigate, setQuery } from '../lib/router.js'
import '../styles/auth.css'

const MODES = {
  login: { tab: 'Log in', title: 'Welcome back', lede: 'Log in to see your saved trips on any device.', submit: 'Log in', busy: 'Logging in…', icon: LogIn },
  signup: { tab: 'Sign up', title: 'Create your account', lede: 'Save your trips and pick them up on any device.', submit: 'Create account', busy: 'Creating account…', icon: UserPlus },
}

/** Only follow in-app paths like "/trips" so ?next= can't send people off-site. */
const safeNext = (next) => (typeof next === 'string' && /^\/(?!\/)/.test(next) && !next.startsWith('/login') ? next : '/trips')

function friendlyError(error) {
  const msg = error?.message || ''
  if (error?.name === 'AbortError' || error instanceof TypeError || /^HTTP 5\d\d/.test(msg) || /^HTTP 404/.test(msg)) {
    return 'We couldn’t reach the Lift Off server. Check your connection and try again in a moment.'
  }
  return msg || 'Something went wrong. Please try again.'
}

function validate(mode, email, password) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'That doesn’t look like an email address.'
  if (!password) errors.password = 'Enter your password.'
  else if (mode === 'signup' && password.length < 8) errors.password = 'Use at least 8 characters.'
  return errors
}

export function LoginPage({ query = {} }) {
  const mode = query.mode === 'signup' ? 'signup' : 'login'
  const m = MODES[mode]
  usePageTitle(m.tab)
  const { loggedIn, email: currentEmail, login, signup } = useAuth()
  const { push } = useToast()
  const next = safeNext(query.next)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const errorRef = useRef(null)
  const tabsId = useId()

  useEffect(() => {
    if (formError) errorRef.current?.focus()
  }, [formError])

  // Switching tabs clears old messages.
  const switchMode = (to) => {
    setErrors({})
    setFormError('')
    setQuery({ mode: to === 'signup' ? 'signup' : undefined })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    const found = validate(mode, email, password)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) {
      document.getElementById(found.email ? 'auth-email' : 'auth-password')?.focus()
      return
    }
    setBusy(true)
    try {
      const who = await (mode === 'signup' ? signup : login)(email.trim(), password)
      push({ title: mode === 'signup' ? 'Account created' : 'Welcome back', body: `Logged in as ${who}`, emoji: '🛫', tone: 'success' })
      navigate(next, undefined, { replace: true })
    } catch (error) {
      setFormError(friendlyError(error))
      setBusy(false)
    }
  }

  if (loggedIn) {
    return (
      <div className="container page auth-page">
        <div className="empty">
          <span className="empty-emoji emoji" aria-hidden="true">
            🎫
          </span>
          <h1>You’re already logged in</h1>
          <p>
            Signed in as <strong>{currentEmail}</strong>.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn btn-primary" href={href(next)}>
              Continue <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container page auth-page">
      <div className="auth-card card">
        <aside className="auth-aside" aria-hidden="true">
          <Logo size={40} />
          <div className="auth-ticket">
            <p className="auth-ticket-label">Boarding pass</p>
            <p className="auth-ticket-route">
              <span>YOU</span>
              <span className="auth-ticket-plane">✈</span>
              <span>ANY</span>
            </p>
            <div className="auth-ticket-row">
              <span>
                <small>Gate</small>
                {mode === 'signup' ? 'NEW' : 'A1'}
              </span>
              <span>
                <small>Seat</small>
                Window
              </span>
              <span>
                <small>Class</small>
                Relaxed
              </span>
            </div>
          </div>
          <p className="auth-aside-note">Your trips, saved and synced. Flights and stays are still sample data, so nothing is booked.</p>
        </aside>

        <div className="auth-main">
          <div className="tabs auth-tabs" role="tablist" aria-label="Log in or sign up">
            {Object.entries(MODES).map(([key, v]) => {
              const Icon = v.icon
              return (
                <button key={key} type="button" role="tab" id={`${tabsId}-${key}`} className="tab" aria-selected={mode === key} aria-controls={`${tabsId}-panel`} tabIndex={mode === key ? 0 : -1} onClick={() => switchMode(key)} onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    const to = mode === 'login' ? 'signup' : 'login'
                    switchMode(to)
                    requestAnimationFrame(() => document.getElementById(`${tabsId}-${to}`)?.focus())
                  }
                }}>
                  <Icon aria-hidden="true" />
                  {v.tab}
                </button>
              )
            })}
          </div>

          <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${mode}`} className="auth-panel">
            <header>
              <h1 className="auth-title">{m.title}</h1>
              <p className="muted">{m.lede}</p>
            </header>

            {formError && (
              <div className="callout callout-danger" role="alert" tabIndex={-1} ref={errorRef}>
                <AlertCircle aria-hidden="true" />
                <div className="callout-body">{formError}</div>
              </div>
            )}

            <form className="stack auth-form" onSubmit={onSubmit} noValidate>
              <Field id="auth-email" label="Email" icon={Mail} error={errors.email}>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete={mode === 'signup' ? 'email' : 'username'}
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy('auth-email', { error: errors.email })}
                />
              </Field>

              <Field id="auth-password" label="Password" icon={Lock} hint={mode === 'signup' ? 'At least 8 characters.' : undefined} error={errors.password}>
                <div className="auth-password">
                  <input
                    id="auth-password"
                    className="input"
                    type={show ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={describedBy('auth-password', { hint: mode === 'signup', error: errors.password })}
                  />
                  <button type="button" className="btn btn-ghost btn-icon btn-sm auth-reveal" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                    {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} aria-busy={busy}>
                {busy ? m.busy : m.submit}
                {!busy && <ArrowRight aria-hidden="true" />}
              </button>
            </form>

            <p className="small muted auth-switch">
              {mode === 'login' ? 'New to Lift Off?' : 'Already have an account?'}{' '}
              <button type="button" className="link-btn" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Create an account' : 'Log in instead'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
