import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { token, loading, activeRole, user } = useAuth()

  if (loading) return null
  if (!token) return <Navigate to="/login" replace />
  if (requiredRole === 'admin' && !user?.is_admin) return <Navigate to="/dashboard" replace />
  if (requiredRole === 'organizer' && !user?.is_organizer) return <Navigate to="/dashboard" replace />
  if (requiredRole === 'organizer' && activeRole !== 'organizer') return <Navigate to="/dashboard" replace />

  return children
}
