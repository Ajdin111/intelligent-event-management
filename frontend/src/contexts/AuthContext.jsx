import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { saveToken, removeToken, getToken, isTokenExpired } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // Current user object from /api/auth/me
  const [loading, setLoading] = useState(true) // True while fetching initial user

  // On mount: if valid token exists, fetch current user
  useEffect(() => {
    const token = getToken()
    if (token && !isTokenExpired(token)) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => removeToken())
        .finally(() => setLoading(false))
    } else {
      removeToken()
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    // POST /api/auth/login — Member 3's endpoint
    const res = await api.post('/auth/login', { email, password })
    saveToken(res.data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  async function register(data) {
    // POST /api/auth/register — Member 3's endpoint
    const res = await api.post('/auth/register', data)
    saveToken(res.data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  function logout() {
    removeToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
