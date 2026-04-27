import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('activeRole') || 'attendee')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('activeRole')
      setToken(null)
      setUser(null)
      setActiveRole('attendee')
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const switchRole = (role) => {
    localStorage.setItem('activeRole', role)
    setActiveRole(role)
  }

  const login = async (email, password) => {
    const res = await authApi.login(email, password)
    const { access_token } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('activeRole', 'attendee')
    setToken(access_token)
    setActiveRole('attendee')
    const meRes = await authApi.me()
    setUser(meRes.data)
    return meRes.data
  }

  const register = async (data) => {
    await authApi.register(data)
    return login(data.email, data.password)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('activeRole')
    setToken(null)
    setUser(null)
    setActiveRole('attendee')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, activeRole, switchRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
