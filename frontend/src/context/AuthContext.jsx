import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AUTH_EVENT, AUTH_KEY, getUserEmail, login as apiLogin, logout as apiLogout, signup as apiSignup } from '../lib/storage.js'

// Who is logged in, for the UI. The real work (talking to /login, /signup,
// /logout and keeping the token) lives in lib/storage.js.

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [email, setEmail] = useState(getUserEmail)

  useEffect(() => {
    const sync = () => setEmail(getUserEmail())
    const onStorage = (e) => {
      if (e.key === AUTH_KEY) sync()
    }
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('storage', onStorage) // other open tabs
    return () => {
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const login = useCallback((em, pw) => apiLogin(em, pw), [])
  const signup = useCallback((em, pw) => apiSignup(em, pw), [])
  const logout = useCallback(() => apiLogout(), [])

  const value = useMemo(() => ({ email, loggedIn: Boolean(email), login, signup, logout }), [email, login, signup, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
