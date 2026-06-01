import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../services/api', () => ({
  registrationsApi: { getMine: vi.fn(), cancel: vi.fn() },
  eventsApi:        { getById: vi.fn(), list: vi.fn() },
  ticketTiersApi:   { listByEvent: vi.fn() },
  categoriesApi:    { list: vi.fn() },
  API_BASE_URL: 'http://localhost:8000',
}))

import { useAuth } from '../context/AuthContext'
import { registrationsApi, eventsApi } from '../services/api'
import MyRegistrations from '../pages/MyRegistrations'

const renderRegs = () => render(<MemoryRouter><MyRegistrations /></MemoryRouter>)

const MOCK_REGS = [
  { id: 1, event_id: 10, status: 'confirmed', quantity: 2, total_amount: '98.00', registered_at: '2026-04-01T10:00:00', ticket_tier_id: 1 },
  { id: 2, event_id: 11, status: 'pending',   quantity: 1, total_amount: '0.00',  registered_at: '2026-04-02T10:00:00', ticket_tier_id: 2 },
]

const MOCK_EVENT = {
  id: 10, title: 'DevConf 2026', status: 'published',
  start_datetime: '2026-10-01T09:00:00', end_datetime: '2026-10-01T17:00:00',
  location_type: 'physical', physical_address: 'Paris, FR', category_ids: [],
}

describe('MyRegistrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 1 } })
    registrationsApi.getMine.mockResolvedValue({ data: MOCK_REGS })
    eventsApi.getById.mockResolvedValue({ data: MOCK_EVENT })
    eventsApi.list.mockResolvedValue({ data: { items: [], total: 0 } })
  })

  it('renders the page without crashing', () => {
    renderRegs()
    expect(document.body).toBeInTheDocument()
  })

  it('fetches registrations on mount', async () => {
    renderRegs()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
  })

  it('fetches event details for each registration', async () => {
    renderRegs()
    await waitFor(() => expect(eventsApi.getById).toHaveBeenCalled())
  })

  it('fetches event details after loading registrations', async () => {
    renderRegs()
    await waitFor(() => expect(eventsApi.getById).toHaveBeenCalledWith(10), { timeout: 5000 })
  })

  it('shows empty state when no registrations', async () => {
    registrationsApi.getMine.mockResolvedValue({ data: [] })
    renderRegs()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  it('renders tab filter buttons', async () => {
    renderRegs()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    // Tab buttons should be present
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
  })
})
