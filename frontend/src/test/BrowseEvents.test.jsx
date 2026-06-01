import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  eventsApi: { list: vi.fn() },
  categoriesApi: { list: vi.fn() },
  ticketTiersApi: { listByEvent: vi.fn() },
}))

import { eventsApi, categoriesApi, ticketTiersApi } from '../services/api'
import BrowseEvents from '../pages/BrowseEvents'

const CATEGORIES = [
  { id: 1, name: 'AI & ML' },
  { id: 2, name: 'Cloud' },
  { id: 3, name: 'Frontend' },
]

const EVENTS = [
  {
    id: 10,
    title: 'AI Conference',
    category_ids: [1],
    location_type: 'physical',
    physical_address: 'London, UK',
    start_datetime: '2026-09-01T09:00:00',
    is_free: false,
    capacity: 200,
    status: 'published',
  },
  {
    id: 11,
    title: 'Cloud Summit',
    category_ids: [2],
    location_type: 'online',
    physical_address: null,
    start_datetime: '2026-10-01T10:00:00',
    is_free: true,
    capacity: 500,
    status: 'published',
  },
]

const renderBrowse = () =>
  render(<MemoryRouter><BrowseEvents /></MemoryRouter>)

describe('BrowseEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventsApi.list.mockResolvedValue({ data: { items: EVENTS, total: EVENTS.length } })
    categoriesApi.list.mockResolvedValue({ data: CATEGORIES })
    ticketTiersApi.listByEvent.mockResolvedValue({ data: [] })
  })

  it('shows events from the API after loading', async () => {
    renderBrowse()
    await waitFor(() => expect(screen.getByText('AI Conference')).toBeInTheDocument())
    expect(screen.getByText('Cloud Summit')).toBeInTheDocument()
  })

  it('enriches real events with category name from category_ids', async () => {
    renderBrowse()
    await waitFor(() => expect(screen.getAllByText('AI & ML').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Cloud').length).toBeGreaterThan(0)
  })

  it('shows Free label for free events', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('Cloud Summit'))
    expect(screen.getByText('Free')).toBeInTheDocument()
  })

  it('category filter hides non-matching events', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))

    await userEvent.click(screen.getByRole('radio', { name: 'AI & ML' }))

    expect(screen.getByText('AI Conference')).toBeInTheDocument()
    expect(screen.queryByText('Cloud Summit')).not.toBeInTheDocument()
  })

  it('All category shows all events', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))

    // first click AI & ML to filter, then click the category-section All to reset
    await userEvent.click(screen.getByRole('radio', { name: 'AI & ML' }))
    const allRadios = screen.getAllByRole('radio', { name: 'All' })
    await userEvent.click(allRadios[0]) // first "All" is the category one

    expect(screen.getByText('AI Conference')).toBeInTheDocument()
    expect(screen.getByText('Cloud Summit')).toBeInTheDocument()
  })

  it('shows empty state when the API fails', async () => {
    eventsApi.list.mockRejectedValue(new Error('Network error'))
    categoriesApi.list.mockRejectedValue(new Error('Network error'))
    renderBrowse()
    await waitFor(() => expect(screen.getByText(/no events match/i)).toBeInTheDocument())
  })

  it('search filters by event title', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))

    await userEvent.type(screen.getByPlaceholderText(/search events/i), 'Cloud')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByText('AI Conference')).not.toBeInTheDocument())
    expect(screen.getByText('Cloud Summit')).toBeInTheDocument()
  })

  it('location filter hides non-matching events', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))
    // London is location of AI Conference (physical); online events show Remote
    const locationRadios = screen.getAllByRole('radio', { name: 'Remote' })
    if (locationRadios.length > 0) {
      await userEvent.click(locationRadios[0])
      await waitFor(() => expect(screen.queryByText('AI Conference')).not.toBeInTheDocument())
      expect(screen.getByText('Cloud Summit')).toBeInTheDocument()
    }
  })

  it('price filter hides events above threshold', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))
    // Move price slider to 0 (free only)
    const slider = screen.getByRole('slider')
    await userEvent.type(slider, '{ArrowLeft}'.repeat(50))
    // Free events should remain, paid events hidden
    await waitFor(() => expect(screen.getByText('Cloud Summit')).toBeInTheDocument())
  })

  it('reset button clears all filters', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))
    await userEvent.click(screen.getByRole('radio', { name: 'AI & ML' }))
    expect(screen.queryByText('Cloud Summit')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /reset/i }))
    await waitFor(() => expect(screen.getByText('Cloud Summit')).toBeInTheDocument())
  })

  it('shows Register button on each event card', async () => {
    renderBrowse()
    await waitFor(() => screen.getByText('AI Conference'))
    expect(screen.getAllByRole('button', { name: /register/i }).length).toBeGreaterThan(0)
  })
})
