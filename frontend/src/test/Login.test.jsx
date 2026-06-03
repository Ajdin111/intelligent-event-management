import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../context/AuthContext'
import Login from '../pages/Login'

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>)

describe('Login', () => {
  const mockLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ login: mockLogin, loading: false })
  })

  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renders a sign in button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders a link to register', () => {
    renderLogin()
    expect(screen.getByText('Create one')).toBeInTheDocument()
  })

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValue({ is_organizer: false, is_admin: false })
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'test@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'),'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123'))
  })

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue({ response: { data: { detail: 'Invalid email or password' } } })
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'bad@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'),'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument())
  })

  it('navigates to dashboard on successful attendee login', async () => {
    mockLogin.mockResolvedValue({ is_organizer: false, is_admin: false })
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'user@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'),'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('disables button while signing in', async () => {
    mockLogin.mockReturnValue(new Promise(() => {})) // never resolves
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'a@b.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'),'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled())
  })
})
