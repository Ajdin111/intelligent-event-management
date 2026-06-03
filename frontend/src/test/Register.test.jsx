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
import Register from '../pages/Register'

const renderRegister = () => render(<MemoryRouter><Register /></MemoryRouter>)

describe('Register', () => {
  const mockRegister = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ register: mockRegister, loading: false })
  })

  it('renders first name, last name, email and password fields', () => {
    renderRegister()
    expect(screen.getByPlaceholderText('Alex')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Smith')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
  })

  it('renders a create account button', () => {
    renderRegister()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('renders a link to login', () => {
    renderRegister()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('calls register on submit', async () => {
    mockRegister.mockResolvedValue({ is_organizer: false })
    renderRegister()
    await userEvent.type(screen.getByPlaceholderText('Alex'), 'Jane')
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe')
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'jane@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(mockRegister).toHaveBeenCalled())
  })

  it('shows error message on registration failure', async () => {
    mockRegister.mockRejectedValue({ response: { data: { detail: 'Email already registered' } } })
    renderRegister()
    await userEvent.type(screen.getByPlaceholderText('Alex'), 'Jane')
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe')
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'existing@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(screen.getByText(/email already registered/i)).toBeInTheDocument())
  })

  it('navigates to dashboard after successful registration', async () => {
    mockRegister.mockResolvedValue({ is_organizer: false, is_admin: false })
    renderRegister()
    await userEvent.type(screen.getByPlaceholderText('Alex'), 'Jane')
    await userEvent.type(screen.getByPlaceholderText('Smith'), 'Doe')
    await userEvent.type(screen.getByPlaceholderText('you@example.com'),'jane@test.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'secret123')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })
})
