import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../services/api', () => ({
  registrationsApi: { getMine: vi.fn(), getTickets: vi.fn() },
  eventsApi:        { getById: vi.fn() },
  ticketTiersApi:   { listByEvent: vi.fn() },
}))

import { useAuth } from '../context/AuthContext'
import { registrationsApi, eventsApi } from '../services/api'
import MyTickets from '../pages/MyTickets'

const renderTickets = () => render(<MemoryRouter><MyTickets /></MemoryRouter>)

const MOCK_REGS = [
  { id: 1, event_id: 10, status: 'confirmed', quantity: 1, total_amount: '49.00', registered_at: '2026-04-01T10:00:00', ticket_tier_id: 1 },
]
const MOCK_TICKETS = [
  { id: 1, registration_id: 1, event_id: 10, qr_code: 'TEQ-ABC123', is_valid: true, issued_at: '2026-04-01T10:00:00' },
]
const MOCK_EVENT = {
  id: 10, title: 'Vector Summit', status: 'published',
  start_datetime: '2026-09-01T09:00:00', location_type: 'physical', physical_address: 'Berlin',
}

describe('MyTickets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 1 } })
    registrationsApi.getMine.mockResolvedValue({ data: MOCK_REGS })
    registrationsApi.getTickets.mockResolvedValue({ data: MOCK_TICKETS })
    eventsApi.getById.mockResolvedValue({ data: MOCK_EVENT })
  })

  it('renders My tickets heading', async () => {
    renderTickets()
    await waitFor(() => expect(screen.getByText(/my tickets/i)).toBeInTheDocument())
  })

  it('fetches registrations on mount', async () => {
    renderTickets()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
  })

  it('fetches tickets for each registration', async () => {
    renderTickets()
    await waitFor(() => expect(registrationsApi.getTickets).toHaveBeenCalledWith(1))
  })

  it('shows event title after loading', async () => {
    renderTickets()
    await waitFor(() => expect(screen.getByText('Vector Summit')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('fetches tickets for confirmed registration', async () => {
    renderTickets()
    await waitFor(() => expect(registrationsApi.getTickets).toHaveBeenCalledWith(1), { timeout: 5000 })
  })

  it('shows empty state when no registrations', async () => {
    registrationsApi.getMine.mockResolvedValue({ data: [] })
    renderTickets()
    await waitFor(() => expect(screen.getByText(/no tickets yet/i)).toBeInTheDocument(), { timeout: 5000 })
  })
})
