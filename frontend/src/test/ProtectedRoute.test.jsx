import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

import { useAuth } from '../context/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'

const Protected = () => <div>Protected content</div>
const wrap = (auth, requiredRole) => render(
  <MemoryRouter initialEntries={['/protected']}>
    <Routes>
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/dashboard" element={<div>Dashboard</div>} />
      <Route path="/protected" element={
        <ProtectedRoute requiredRole={requiredRole}><Protected /></ProtectedRoute>
      } />
    </Routes>
  </MemoryRouter>
)

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    useAuth.mockReturnValue({ token: 'tok', loading: false, user: { is_organizer: false }, activeRole: 'attendee' })
    wrap({ token: 'tok' })
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to login when no token', () => {
    useAuth.mockReturnValue({ token: null, loading: false, user: null, activeRole: null })
    wrap({ token: null })
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders null while loading', () => {
    useAuth.mockReturnValue({ token: null, loading: true, user: null, activeRole: null })
    const { container } = wrap({ loading: true })
    expect(container.firstChild).toBeNull()
  })

  it('allows access when requiredRole matches activeRole', () => {
    useAuth.mockReturnValue({ token: 'tok', loading: false, user: { is_organizer: true }, activeRole: 'organizer' })
    wrap({}, 'organizer')
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to dashboard when role does not match', () => {
    useAuth.mockReturnValue({ token: 'tok', loading: false, user: { is_organizer: false }, activeRole: 'attendee' })
    wrap({}, 'organizer')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })
})
