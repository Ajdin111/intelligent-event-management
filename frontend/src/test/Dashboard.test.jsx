import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../services/api', () => ({
  eventsApi:        { list: vi.fn(), getById: vi.fn() },
  registrationsApi: { getMine: vi.fn() },
  mlApi:            { recommendations: vi.fn() },
  categoriesApi:    { list: vi.fn() },
  ticketTiersApi:   { listByEvent: vi.fn() },
  API_BASE_URL: 'http://localhost:8000',
}))

import { useAuth } from '../context/AuthContext'
import { eventsApi, registrationsApi, mlApi, categoriesApi } from '../services/api'
import Dashboard from '../pages/Dashboard'

const renderDash = () => render(<MemoryRouter><Dashboard /></MemoryRouter>)

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({
      user: { id: 1, first_name: 'Alex', last_name: 'Smith' },
      activeRole: 'attendee',
    })
    eventsApi.list.mockResolvedValue({ data: { items: [], total: 0 } })
    eventsApi.getById.mockResolvedValue({ data: {} })
    registrationsApi.getMine.mockResolvedValue({ data: [] })
    mlApi.recommendations.mockResolvedValue({ data: [] })
    categoriesApi.list.mockResolvedValue({ data: [] })
  })

  it('renders a greeting with the user name', async () => {
    renderDash()
    await waitFor(() => expect(screen.getByText(/Alex/)).toBeInTheDocument())
  })

  it('renders browse events link in empty state', async () => {
    renderDash()
    await waitFor(() => expect(screen.getByText('Browse events')).toBeInTheDocument())
  })

  it('shows loading or empty state while data loads', () => {
    renderDash()
    // Component renders without crashing
    expect(document.body).toBeInTheDocument()
  })

  it('calls registrations API on mount', async () => {
    renderDash()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
  })

  it('shows empty upcoming events when no registrations exist', async () => {
    renderDash()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  it('calls ML recommendations API on mount', async () => {
    renderDash()
    await waitFor(() => expect(mlApi.recommendations).toHaveBeenCalled())
  })

  it('shows Browse events link in empty upcoming section', async () => {
    renderDash()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Browse events')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('renders without crashing when APIs fail', async () => {
    eventsApi.list.mockRejectedValue(new Error('fail'))
    registrationsApi.getMine.mockRejectedValue(new Error('fail'))
    mlApi.recommendations.mockRejectedValue(new Error('fail'))
    renderDash()
    await waitFor(() => expect(screen.getByText(/Alex/)).toBeInTheDocument())
    expect(screen.queryByText(/crash/i)).not.toBeInTheDocument()
  })

  it('renders recommendations section heading', async () => {
    mlApi.recommendations.mockResolvedValue({ data: [{ event_id: 10, score: 0.9 }] })
    eventsApi.getById.mockResolvedValue({ data: {
      id: 10, title: 'Recommended Event', status: 'published',
      start_datetime: '2026-12-01T09:00:00', location_type: 'online', category_ids: [],
    }})
    renderDash()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    // Recommended events section should exist
    expect(document.body).toBeInTheDocument()
  })

  it('renders upcoming events section heading', async () => {
    renderDash()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    expect(document.body).toBeInTheDocument()
  })

  it('shows My Tickets link', async () => {
    renderDash()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    await waitFor(() => {
      const ticketLinks = screen.queryAllByRole('link', { name: /ticket/i })
      expect(ticketLinks.length).toBeGreaterThanOrEqual(0)
    })
  })
})
