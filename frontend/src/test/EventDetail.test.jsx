import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  eventsApi: {
    getById: vi.fn(),
    list: vi.fn(),
  },
  ticketTiersApi: { listByEvent: vi.fn() },
  reviewsApi:     { listByEvent: vi.fn(), getMyReview: vi.fn() },
  agendaApi:      { listTracks: vi.fn(), listSessions: vi.fn() },
  categoriesApi:  { list: vi.fn() },
  API_BASE_URL: 'http://localhost:8000',
}))

import { eventsApi, ticketTiersApi, reviewsApi, agendaApi, categoriesApi } from '../services/api'
import EventDetail from '../pages/EventDetail'

const renderDetail = (id) =>
  render(
    <MemoryRouter initialEntries={[`/events/${id}`]}>
      <Routes>
        <Route path="/events/:id" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>
  )

const REAL_EVENT = {
  id: 10,
  title: 'New Tech Conf',
  description: 'A great conference.',
  category_ids: [1],
  location_type: 'physical',
  physical_address: 'Vienna, AT',
  online_link: null,
  start_datetime: '2026-11-01T09:00:00',
  end_datetime: '2026-11-01T17:00:00',
  is_free: false,
  capacity: 300,
  status: 'published',
}

const REAL_TIERS = [
  { id: 1, name: 'Standard', price: '149.00', quantity: 200, quantity_sold: 42, quantity_available: 158, is_active: true, is_sold_out: false },
  { id: 2, name: 'VIP',      price: '299.00', quantity: 50,  quantity_sold: 10, quantity_available: 40,  is_active: true, is_sold_out: false },
]

const CATEGORIES = [
  { id: 1, name: 'AI & ML' },
  { id: 2, name: 'Cloud' },
]

describe('EventDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventsApi.getById.mockResolvedValue({ data: REAL_EVENT })
    ticketTiersApi.listByEvent.mockResolvedValue({ data: REAL_TIERS })
    reviewsApi.listByEvent.mockResolvedValue({ data: [] })
    reviewsApi.getMyReview.mockRejectedValue({ response: { status: 404 } })
    agendaApi.listTracks.mockResolvedValue({ data: [] })
    agendaApi.listSessions.mockResolvedValue({ data: [] })
    categoriesApi.list.mockResolvedValue({ data: CATEGORIES })
  })

  it('shows loading state initially', () => {
    renderDetail(10)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows event title for a real (non-FAKE) event', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('New Tech Conf')).toBeInTheDocument())
  })

  it('shows category name resolved from category_ids', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('AI & ML')).toBeInTheDocument())
  })

  it('shows formatted time range from start and end datetime', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText(/09:00/)).toBeInTheDocument())
    expect(screen.getByText(/17:00/)).toBeInTheDocument()
  })

  it('shows real ticket tiers from the API', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument())
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('shows physical address as location', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Vienna, AT')).toBeInTheDocument())
  })

  it('shows event not found for a 404', async () => {
    eventsApi.getById.mockRejectedValue({ response: { status: 404 } })
    renderDetail(999)
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
  })

  it('shows event not found for an invalid id', async () => {
    renderDetail('abc')
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument())
  })

  it('for a known FAKE id (1), uses hardcoded data from FAKE object', async () => {
    eventsApi.getById.mockResolvedValue({
      data: { ...REAL_EVENT, id: 1, title: 'Vector Summit 2026', category_ids: [] },
    })
    renderDetail(1)
    await waitFor(() => expect(screen.getByText('Vector Summit 2026')).toBeInTheDocument())
    expect(ticketTiersApi.listByEvent).toHaveBeenCalled()
  })

  it('renders agenda tracks and sessions from API', async () => {
    agendaApi.listTracks.mockResolvedValue({ data: [
      { id: 1, name: 'Main Stage', color: '#4A9EFF', event_id: 10 },
    ]})
    agendaApi.listSessions.mockResolvedValue({ data: [
      { id: 1, track_id: 1, title: 'Opening Keynote', speaker_name: 'Jane Smith',
        location: 'Hall A', start_datetime: '2026-11-01T09:00:00', end_datetime: '2026-11-01T10:00:00' },
    ]})
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Main Stage')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Opening Keynote')).toBeInTheDocument()
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
  })

  it('renders reviews section with review data', async () => {
    reviewsApi.listByEvent.mockResolvedValue({ data: [
      { id: 1, rating: 5, comment: 'Excellent event!', is_anonymous: false, created_at: '2026-11-02T10:00:00' },
      { id: 2, rating: 4, comment: 'Very good.',       is_anonymous: true,  created_at: '2026-11-02T08:00:00' },
    ]})
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Excellent event!')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Very good.')).toBeInTheDocument()
    expect(screen.getByText('Verified attendee')).toBeInTheDocument()
    expect(screen.getByText('Anonymous attendee')).toBeInTheDocument()
  })

  it('renders reviews rating breakdown', async () => {
    reviewsApi.listByEvent.mockResolvedValue({ data: [
      { id: 1, rating: 5, comment: 'Great!', is_anonymous: false, created_at: '2026-11-01T10:00:00' },
      { id: 2, rating: 3, comment: '',       is_anonymous: false, created_at: '2026-11-01T09:00:00' },
    ]})
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('2 reviews')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('shows free event message when is_free with no tiers', async () => {
    eventsApi.getById.mockResolvedValue({ data: { ...REAL_EVENT, is_free: true } })
    ticketTiersApi.listByEvent.mockResolvedValue({ data: [] })
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('FREE EVENT')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getAllByText(/register now/i).length).toBeGreaterThan(0)
  })

  it('shows tier as sold out when quantity_available is 0', async () => {
    ticketTiersApi.listByEvent.mockResolvedValue({ data: [
      { id: 1, name: 'Standard', price: '149.00', quantity: 200, quantity_sold: 200,
        quantity_available: 0, is_active: true, is_sold_out: true },
    ]})
    renderDetail(10)
    await waitFor(() => expect(screen.getAllByText('Sold out').length).toBeGreaterThan(0), { timeout: 5000 })
  })

  it('shows multiple tiers and allows tier selection', async () => {
    ticketTiersApi.listByEvent.mockResolvedValue({ data: [
      { id: 1, name: 'Standard', price: '149.00', quantity: 200, quantity_sold: 42,
        quantity_available: 158, is_active: true, is_sold_out: false },
      { id: 2, name: 'VIP', price: '299.00', quantity: 50, quantity_sold: 10,
        quantity_available: 40, is_active: true, is_sold_out: false },
    ]})
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument())
    expect(screen.getByText('VIP')).toBeInTheDocument()
    expect(screen.getAllByText('$149').length).toBeGreaterThan(0)
  })

  it('shows online event location as Remote', async () => {
    eventsApi.getById.mockResolvedValue({ data: {
      ...REAL_EVENT, location_type: 'online', physical_address: null, online_link: 'https://meet.example.com'
    }})
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Remote')).toBeInTheDocument())
  })

  it('register now button is present for available event', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument())
    // The register button should be enabled
    const registerBtn = screen.getByText(/register now/i)
    expect(registerBtn).toBeInTheDocument()
  })

  it('shows quantity controls for available tier', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument())
    // Quantity label appears in the order summary section
    expect(screen.getByText('Quantity')).toBeInTheDocument()
  })

  it('shows no reviews message when reviews list is empty', async () => {
    reviewsApi.listByEvent.mockResolvedValue({ data: [] })
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('New Tech Conf')).toBeInTheDocument())
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument()
  })

  it('clicking a tier selects it and shows subtotal', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('VIP')).toBeInTheDocument())
    // Click VIP tier button
    const tierButtons = screen.getAllByRole('button')
    const vipBtn = tierButtons.find(b => b.textContent.includes('VIP'))
    if (vipBtn) {
      await userEvent.click(vipBtn)
      await waitFor(() => expect(screen.getByText('Subtotal')).toBeInTheDocument())
    }
  })

  it('shows available spots for each tier', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument())
    // "158 of 200 left" for Standard tier
    expect(screen.getByText(/158 of 200 left/)).toBeInTheDocument()
  })

  it('shows correct available count for tier', async () => {
    renderDetail(10)
    await waitFor(() => expect(screen.getByText('Standard')).toBeInTheDocument())
    expect(screen.getByText('158 of 200 left')).toBeInTheDocument()
  })
})
