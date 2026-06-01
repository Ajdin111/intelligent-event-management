import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../services/api', () => ({
  registrationsApi: { getMine: vi.fn() },
  eventsApi:        { getById: vi.fn() },
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

import { useAuth } from '../context/AuthContext'
import { registrationsApi, eventsApi } from '../services/api'
import Feedback from '../pages/Feedback'

const renderFeedback = () => render(<MemoryRouter><Feedback /></MemoryRouter>)

const PAST_EVENT = {
  id: 1, title: 'Past Conference', status: 'published',
  start_datetime: '2025-01-01T09:00:00', end_datetime: '2025-01-01T17:00:00',
  location_type: 'physical', physical_address: 'Vienna', category_ids: [],
}

const MOCK_REGS = [
  { id: 1, event_id: 1, status: 'confirmed', quantity: 1, total_amount: '49.00', registered_at: '2025-01-01T10:00:00' },
]

describe('Feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ user: { id: 1 } })
    registrationsApi.getMine.mockResolvedValue({ data: MOCK_REGS })
    eventsApi.getById.mockResolvedValue({ data: PAST_EVENT })
  })

  it('renders the Feedback heading', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Feedback')).toBeInTheDocument())
  })

  it('fetches registrations on mount', async () => {
    renderFeedback()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
  })

  it('fetches event details for confirmed registrations', async () => {
    renderFeedback()
    await waitFor(() => expect(eventsApi.getById).toHaveBeenCalledWith(1), { timeout: 5000 })
  })

  it('shows past event title', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Past Conference')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('shows empty state when no confirmed past registrations', async () => {
    registrationsApi.getMine.mockResolvedValue({ data: [] })
    renderFeedback()
    await waitFor(() => expect(screen.getByText(/no events to review yet/i)).toBeInTheDocument(), { timeout: 5000 })
  })

  it('shows location for physical events', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Past Conference')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText(/Vienna/i)).toBeInTheDocument()
  })

  it('does not crash when event API fails', async () => {
    eventsApi.getById.mockRejectedValue(new Error('Not found'))
    renderFeedback()
    await waitFor(() => expect(registrationsApi.getMine).toHaveBeenCalled())
    expect(screen.queryByText(/crash/i)).not.toBeInTheDocument()
  })

  it('shows event date formatted correctly', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Past Conference')).toBeInTheDocument(), { timeout: 5000 })
    // Jan 1 2025 should appear in some date format
    expect(document.body.textContent).toMatch(/2025/)
  })

  it('shows EVT badge for physical events', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Past Conference')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('EVT')).toBeInTheDocument()
  })

  it('clicking event card shows loading state', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Past Conference')).toBeInTheDocument(), { timeout: 5000 })
    // Click the event header to expand — triggers inner loading
    await userEvent.click(screen.getByText('Past Conference'))
    // The event item should now be in open state (has fb-event-item--open class or loading text)
    await waitFor(() => expect(document.querySelector('.fb-event-item--open')).toBeTruthy(), { timeout: 3000 })
  })

  it('clicking expanded event again collapses it', async () => {
    renderFeedback()
    await waitFor(() => expect(screen.getByText('Past Conference')).toBeInTheDocument(), { timeout: 5000 })
    await userEvent.click(screen.getByText('Past Conference'))
    await waitFor(() => expect(document.querySelector('.fb-event-item--open')).toBeTruthy(), { timeout: 3000 })
    // Click again to close
    await userEvent.click(screen.getByText('Past Conference'))
    await waitFor(() => expect(document.querySelector('.fb-event-item--open')).toBeFalsy(), { timeout: 3000 })
  })
})
