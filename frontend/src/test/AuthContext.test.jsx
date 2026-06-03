import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
  eventsApi: { list: vi.fn() },
  categoriesApi: { list: vi.fn() },
}))

import { authApi } from '../services/api'
import { AuthProvider, useAuth } from '../context/AuthContext'

function Spy() {
  const { user, token, activeRole } = useAuth()
  return (
    <>
      <div data-testid="token">{token ?? 'none'}</div>
      <div data-testid="user">{user ? user.email : 'null'}</div>
      <div data-testid="role">{activeRole}</div>
    </>
  )
}

function LoginButton() {
  const { login } = useAuth()
  return (
    <button onClick={() => login('user@test.com', 'pass123')}>Login</button>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    authApi.me.mockResolvedValue({ data: { id: 1, email: 'user@test.com' } })
  })

  it('renders children without crashing', () => {
    render(<AuthProvider><div data-testid="child">hello</div></AuthProvider>)
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('starts with no token and no user when localStorage is empty', async () => {
    render(<AuthProvider><Spy /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('none'))
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  it('loads user from /me when a token exists in localStorage', async () => {
    localStorage.setItem('token', 'existing-token')
    render(<AuthProvider><Spy /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@test.com'))
    expect(authApi.me).toHaveBeenCalledOnce()
  })

  it('clears token, user, and role when auth:unauthorized fires', async () => {
    localStorage.setItem('token', 'existing-token')
    render(<AuthProvider><Spy /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@test.com'))

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    })

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('null'))
    expect(screen.getByTestId('token')).toHaveTextContent('none')
    expect(screen.getByTestId('role')).toHaveTextContent('attendee')
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('activeRole')).toBeNull()
  })

  it('login stores token in localStorage and populates user', async () => {
    authApi.login.mockResolvedValue({ data: { access_token: 'new-token' } })
    render(
      <AuthProvider>
        <Spy />
        <LoginButton />
      </AuthProvider>
    )
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('none'))

    await userEvent.click(screen.getByText('Login'))

    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('user@test.com'))
    expect(localStorage.getItem('token')).toBe('new-token')
  })

  it('clears token from localStorage when /me fails on mount', async () => {
    localStorage.setItem('token', 'bad-token')
    authApi.me.mockRejectedValue(new Error('Unauthorized'))
    render(<AuthProvider><Spy /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('none'))
    expect(localStorage.getItem('token')).toBeNull()
  })
})
