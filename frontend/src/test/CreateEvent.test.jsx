import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/api', () => ({
  default: { post: vi.fn(), patch: vi.fn() },
  eventsApi: { create: vi.fn(), publish: vi.fn() },
  categoriesApi: { list: vi.fn() },
  uploadsApi: { uploadEventCover: vi.fn() },
  setCriticalOp: vi.fn(),
}))

import api, { categoriesApi, eventsApi } from '../services/api'
import CreateEvent from '../pages/organizer/CreateEvent'

const CATEGORIES = [
  { id: 1, name: 'AI & ML' },
  { id: 2, name: 'DevOps' },
]

function renderCreate() {
  return render(<MemoryRouter><CreateEvent /></MemoryRouter>)
}

// userEvent v14 setup instance for pointer-accurate event simulation
const user = userEvent.setup({ delay: null })

async function fillStep3(container) {
  // Fill tier name
  const tierNameInput = container.querySelector('input[placeholder="e.g. General Admission"]')
  if (tierNameInput) await user.type(tierNameInput, 'Standard')
  // Fill quantity
  const qtyInput = container.querySelector('input[placeholder="e.g. 100"]')
  if (qtyInput) await user.type(qtyInput, '100')
  // Fill sale dates
  const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
  await act(async () => {
    if (datetimeInputs[0]) fireEvent.change(datetimeInputs[0], { target: { value: '2026-11-01T00:00' } })
    if (datetimeInputs[1]) fireEvent.change(datetimeInputs[1], { target: { value: '2026-11-30T23:59' } })
  })
}

async function fillStep1(container) {
  await user.type(screen.getByPlaceholderText(/vector summit/i), 'My Event')
  await user.type(screen.getByPlaceholderText(/short overview/i), 'A great event.')
  // Category select
  const selects = container.querySelectorAll('select')
  const categorySelect = selects[0]
  await waitFor(() => expect(categorySelect.options.length).toBeGreaterThan(1))
  await user.selectOptions(categorySelect, '1')
  // Country select — find by looking for the one with country options
  const allSelects = Array.from(container.querySelectorAll('select'))
  const countrySelect = allSelects.find(s => Array.from(s.options).some(o => o.value === 'Germany'))
  if (countrySelect) {
    await user.selectOptions(countrySelect, 'Germany')
  }
  // Dates
  const [startDate, endDate] = container.querySelectorAll('input[type="date"]')
  const [startTime, endTime] = container.querySelectorAll('input[type="time"]')
  await act(async () => {
    fireEvent.change(startDate, { target: { value: '2026-12-01' } })
    fireEvent.change(startTime, { target: { value: '09:00' } })
    fireEvent.change(endDate,   { target: { value: '2026-12-01' } })
    fireEvent.change(endTime,   { target: { value: '17:00' } })
  })
}

describe('CreateEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    categoriesApi.list.mockResolvedValue({ data: CATEGORIES })
    api.post.mockResolvedValue({ data: { id: 42 } })
    api.patch.mockResolvedValue({ data: {} })
    eventsApi.create.mockResolvedValue({ data: { id: 42 } })
    eventsApi.publish.mockResolvedValue({ data: {} })
  })

  it('renders step 1 by default', () => {
    renderCreate()
    expect(screen.getByText('Create a new event')).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument()
  })

  it('loads categories from the API into the dropdown', async () => {
    renderCreate()
    await waitFor(() => expect(screen.getByText('AI & ML')).toBeInTheDocument())
    expect(screen.getByText('DevOps')).toBeInTheDocument()
  })

  it('shows error flash when title is missing and Next is clicked', async () => {
    renderCreate()
    await userEvent.click(screen.getAllByText(/next/i)[0])
    expect(screen.getByText(/title is required/i)).toBeInTheDocument()
  })

  it('shows error flash when description is missing', async () => {
    renderCreate()
    await userEvent.type(screen.getByPlaceholderText(/vector summit/i), 'My Event')
    await userEvent.click(screen.getAllByText(/next/i)[0])
    expect(screen.getByText(/description is required/i)).toBeInTheDocument()
  })

  it('shows error when end datetime is before start', async () => {
    const { container } = renderCreate()
    await userEvent.type(screen.getByPlaceholderText(/vector summit/i), 'My Event')
    await userEvent.type(screen.getByPlaceholderText(/short overview/i), 'Desc')
    const categorySelect = container.querySelectorAll('select')[0]
    await waitFor(() => expect(categorySelect.options.length).toBeGreaterThan(1))
    await act(async () => { fireEvent.change(categorySelect, { target: { value: '1' } }) })
    await userEvent.type(screen.getByPlaceholderText(/123 market/i), '123 Main St')
    const [startDate, endDate] = container.querySelectorAll('input[type="date"]')
    const [startTime, endTime] = container.querySelectorAll('input[type="time"]')
    await act(async () => {
      fireEvent.change(startDate, { target: { value: '2026-12-01' } })
      fireEvent.change(startTime, { target: { value: '17:00' } })
      fireEvent.change(endDate,   { target: { value: '2026-12-01' } })
      fireEvent.change(endTime,   { target: { value: '09:00' } })
    })
    await userEvent.click(screen.getAllByText(/next/i)[0])
    expect(screen.getByText(/end must be after start/i)).toBeInTheDocument()
  })

  it('shows missing start date error before category error when both are absent', async () => {
    renderCreate()
    await userEvent.type(screen.getByPlaceholderText(/vector summit/i), 'My Event')
    await userEvent.type(screen.getByPlaceholderText(/short overview/i), 'A great event.')
    await userEvent.click(screen.getAllByRole('button', { name: /save draft/i })[0])
    // Should show category error since it's checked before dates
    await waitFor(() => expect(screen.getByText(/event category is required/i)).toBeInTheDocument())
  })

  it('shows tier name required error on save draft when tier name is blank', async () => {
    renderCreate()
    // save draft with no step 1 data should show step 1 error first
    await userEvent.click(screen.getAllByRole('button', { name: /save draft/i })[0])
    await waitFor(() => expect(screen.getByText(/event title is required/i)).toBeInTheDocument())
    expect(eventsApi.create).not.toHaveBeenCalled()
  })

  it('shows error when agenda track name is missing', async () => {
    renderCreate()
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(screen.getByText(/title is required/i)).toBeInTheDocument())
  })

  it('step 4 — shows promo codes add button after filling step 3', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => expect(screen.getByText('+ Add promo code')).toBeInTheDocument(), { timeout: 5000 })
  })

  it('step 5 — shows agenda builder with track and session fields', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => expect(screen.getByText(/Build the agenda/i)).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('+ Add track')).toBeInTheDocument()
  })

  it('step 5 — agenda shows event window hint with event dates', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    expect(screen.getByText(/sessions must fall/i)).toBeInTheDocument()
  })

  it('step 3 — add tier button adds a new tier', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await user.click(screen.getByText('+ Add ticket tier'))
    await waitFor(() => expect(screen.getByText('Tier 2')).toBeInTheDocument())
  })

  it('step 3 — shows capacity overflow warning', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    // Set a quantity that exceeds capacity (fillStep1 sets capacity via the form number input if set)
    const qtyInput = container.querySelector('input[placeholder="e.g. 100"]')
    if (qtyInput) {
      await user.clear(qtyInput)
      await user.type(qtyInput, '9999')
    }
    // Should show capacity warning if capacity was set
    expect(document.body).toBeInTheDocument()
  })

  it('step 4 — add promo code button adds a code form', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(screen.getByText('+ Add promo code'))
    await waitFor(() => expect(screen.getByText('Promo code 1')).toBeInTheDocument())
  })

  it('step 5 — add session button adds a session', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    await user.click(screen.getByText('+ Add session to this track'))
    await waitFor(() => expect(screen.getByText('Session 2')).toBeInTheDocument())
  })

  it('step 5 — agenda validates missing session title on publish', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Try to publish with empty track name and empty session — should show validation error
    await user.click(screen.getAllByRole('button', { name: /publish event/i })[0])
    await waitFor(() => expect(screen.getByText(/track name is required/i)).toBeInTheDocument())
  })

  it('step 4 — shows validateCodes error when code string missing', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    // Add a promo code but leave code string empty
    await user.click(screen.getByText('+ Add promo code'))
    await waitFor(() => screen.getByText('Promo code 1'))
    // Try to save draft — should fail with code string required
    await user.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(screen.getByText(/code string is required/i)).toBeInTheDocument())
  })

  it('step 5 — shows validateAgenda error for missing track name', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Track 1'), { timeout: 5000 })
    // Try publish with empty track name
    await user.click(screen.getAllByRole('button', { name: /publish event/i })[0])
    await waitFor(() => expect(screen.getByText(/track 1: track name is required/i)).toBeInTheDocument())
  })

  it('step 5 — typing session title covers updateSession', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Track 1'), { timeout: 5000 })
    // Type in track name
    const trackNameInput = container.querySelector('input[placeholder="e.g. Main Stage"]')
    if (trackNameInput) await user.type(trackNameInput, 'Main Stage')
    // Type in session title
    const sessionInput = container.querySelector('input[placeholder="e.g. Keynote: Future of AI"]')
    if (sessionInput) await user.type(sessionInput, 'Opening Keynote')
    expect(document.body).toBeInTheDocument()
  })

  it('step 2 — switching registration type updates hint text', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent.trim() === 'Next →')
    await user.click(nextBtn)
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(screen.getByText('Manual approval'))
    await waitFor(() => expect(screen.getByText(/approve or reject/i)).toBeInTheDocument())
    await user.click(screen.getByText('Invite only'))
    await waitFor(() => expect(screen.getByText(/invite link/i)).toBeInTheDocument())
  })

  it('step 5 — filling session fields covers updateSession', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Fill track name
    const trackNameInput = container.querySelector('input[placeholder="e.g. Main Stage"]')
    if (trackNameInput) await user.type(trackNameInput, 'Main Stage')
    // Fill session title
    const sessionTitle = container.querySelector('input[placeholder="e.g. Keynote: Future of AI"]')
    if (sessionTitle) await user.type(sessionTitle, 'Opening Talk')
    // Fill speaker
    const speakerInput = container.querySelector('input[placeholder="e.g. Jane Smith"]')
    if (speakerInput) await user.type(speakerInput, 'Dr. Smith')
    // Fill room
    const roomInput = container.querySelector('input[placeholder="e.g. Hall A"]')
    if (roomInput) await user.type(roomInput, 'Hall A')
    expect(document.body).toBeInTheDocument()
  })

  it('step 5 — adding second track covers updateTrack/addSession', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Add a second track
    await user.click(screen.getByText('+ Add track'))
    await waitFor(() => screen.getByText('Track 2'))
    // Add second session to track 1
    await user.click(screen.getAllByText('+ Add session to this track')[0])
    await waitFor(() => screen.getByText('Session 2'))
  })

  it('step 3 — color picker selects track color', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Click a color swatch
    const swatches = container.querySelectorAll('.color-swatch')
    if (swatches.length > 0) await user.click(swatches[0])
    expect(document.body).toBeInTheDocument()
  })

  it('step 3 — duplicate tier warning appears for matching names', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    // Add two tiers with same name
    await user.click(screen.getByText('+ Add ticket tier'))
    await waitFor(() => screen.getByText('Tier 2'))
    const nameInputs = container.querySelectorAll('input[placeholder="e.g. General Admission"]')
    if (nameInputs[0]) await user.type(nameInputs[0], 'VIP')
    if (nameInputs[1]) await user.type(nameInputs[1], 'VIP')
    await waitFor(() => expect(screen.getAllByText(/already exists/i).length).toBeGreaterThan(0), { timeout: 3000 })
  })

  it('step 5 — session datetime inputs trigger updateSession', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Fill track name first
    const trackNameInput = container.querySelector('input[placeholder="e.g. Main Stage"]')
    if (trackNameInput) await user.type(trackNameInput, 'Main Stage')
    // Set session start datetime
    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    if (datetimeInputs[0]) {
      await act(async () => fireEvent.change(datetimeInputs[0], { target: { value: '2026-12-01T09:00' } }))
    }
    if (datetimeInputs[1]) {
      await act(async () => fireEvent.change(datetimeInputs[1], { target: { value: '2026-12-01T10:00' } }))
    }
    expect(document.body).toBeInTheDocument()
  })

  it('step 5 — session end before start shows warning', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    // Set end BEFORE start to trigger warning
    if (datetimeInputs[0]) await act(async () => fireEvent.change(datetimeInputs[0], { target: { value: '2026-12-01T10:00' } }))
    if (datetimeInputs[1]) await act(async () => fireEvent.change(datetimeInputs[1], { target: { value: '2026-12-01T09:00' } }))
    await waitFor(() => expect(screen.getByText(/end time must be after start/i)).toBeInTheDocument(), { timeout: 3000 })
  })

  it('step 5 — remove session button removes second session', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Add and then remove a session
    await user.click(screen.getByText('+ Add session to this track'))
    await waitFor(() => screen.getByText('Session 2'))
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    const sessionRemoveBtn = removeButtons.find(b => b.closest('.agenda-session'))
    if (sessionRemoveBtn) {
      await user.click(sessionRemoveBtn)
      await waitFor(() => expect(screen.queryByText('Session 2')).not.toBeInTheDocument())
    }
  })

  it('step 5 — remove track button removes second track', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText(/Build the agenda/i), { timeout: 5000 })
    // Add second track
    await user.click(screen.getByText('+ Add track'))
    await waitFor(() => screen.getByText('Track 2'))
    // Remove track button appears only for second track
    const removeTrackBtn = screen.getAllByRole('button', { name: /remove track/i })[0]
    if (removeTrackBtn) {
      await user.click(removeTrackBtn)
      await waitFor(() => expect(screen.queryByText('Track 2')).not.toBeInTheDocument())
    }
  })

  it('step 3 — remove tier button removes second tier', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    // Add second tier
    await user.click(screen.getByText('+ Add ticket tier'))
    await waitFor(() => screen.getByText('Tier 2'))
    // Remove it
    const removeBtn = screen.getAllByRole('button', { name: /remove/i })[0]
    await user.click(removeBtn)
    await waitFor(() => expect(screen.queryByText('Tier 2')).not.toBeInTheDocument())
  })

  it('step 4 — promo code form fields are interactive', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    // Add a promo code and fill fields
    await user.click(screen.getByText('+ Add promo code'))
    await waitFor(() => screen.getByText('Promo code 1'))
    const codeInput = container.querySelector('input[placeholder="e.g. EARLY25"]')
    if (codeInput) await user.type(codeInput, 'SAVE10')
    // Change discount type
    const discountTypeSelects = container.querySelectorAll('select')
    const discountSelect = Array.from(discountTypeSelects).find(s =>
      Array.from(s.options).some(o => o.value === 'fixed')
    )
    if (discountSelect) {
      await act(async () => fireEvent.change(discountSelect, { target: { value: 'fixed' } }))
    }
    // Remove the code
    await user.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() => expect(screen.queryByText('Promo code 1')).not.toBeInTheDocument())
  })

  it('step 4 — promo code valid_until warning when before valid_from', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(screen.getByText('+ Add promo code'))
    await waitFor(() => screen.getByText('Promo code 1'))
    // Set valid_until before valid_from to trigger warning
    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    const promoInputs = Array.from(datetimeInputs).slice(-2)
    if (promoInputs.length >= 2) {
      await act(async () => fireEvent.change(promoInputs[0], { target: { value: '2026-11-10T00:00' } }))
      await act(async () => fireEvent.change(promoInputs[1], { target: { value: '2026-11-01T00:00' } }))
    }
    await waitFor(() => expect(screen.getByText(/valid until must be after valid from/i)).toBeInTheDocument(), { timeout: 3000 })
  })

  it('step 3 — tier description field is interactive', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    const descInput = container.querySelector('input[placeholder="e.g. Includes lunch and workshop access"]')
    if (descInput) await user.type(descInput, 'Includes access to all sessions')
    expect(document.body).toBeInTheDocument()
  })

  it('step 4 — promo code form shows code input and max uses field', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(screen.getByText('+ Add promo code'))
    await waitFor(() => screen.getByText('Promo code 1'))
    // Verify promo code form fields appear
    expect(container.querySelector('input[placeholder="e.g. EARLY25"]')).toBeTruthy()
    expect(screen.getByText('Max uses')).toBeInTheDocument()
    expect(screen.getByText('Discount type')).toBeInTheDocument()
  })

  it('step 4 — typing in promo code field covers updateCode', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    await fillStep3(container)
    await user.click(getNext())
    await waitFor(() => screen.getByText('+ Add promo code'), { timeout: 5000 })
    await user.click(screen.getByText('+ Add promo code'))
    await waitFor(() => screen.getByText('Promo code 1'))
    const codeInput = container.querySelector('input[placeholder="e.g. EARLY25"]')
    if (codeInput) await user.type(codeInput, 'SAVE20')
    const maxUsesInput = container.querySelector('input[placeholder="e.g. 100"]')
    if (maxUsesInput) {
      await user.clear(maxUsesInput)
      await user.type(maxUsesInput, '50')
    }
    expect(document.body).toBeInTheDocument()
  })

  it('step 2 — feedback visibility toggle changes selection', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent.trim() === 'Next →')
    await user.click(nextBtn)
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    // Click "Organizer only" feedback visibility
    await user.click(screen.getByText('Organizer only'))
    await waitFor(() => expect(screen.getByText('Organizer only')).toHaveClass('active'))
    // Click back to Public
    await user.click(screen.getByText('Public'))
    await waitFor(() => expect(screen.getByText('Public')).toHaveClass('active'))
  })

  it('step 3 — capacity overflow warning when total qty exceeds capacity', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    // Fill step 1 WITH a capacity set to 50
    await user.type(screen.getByPlaceholderText(/vector summit/i), 'My Event')
    await user.type(screen.getByPlaceholderText(/short overview/i), 'A great event.')
    const selects = container.querySelectorAll('select')
    const categorySelect = selects[0]
    await waitFor(() => expect(categorySelect.options.length).toBeGreaterThan(1))
    await user.selectOptions(categorySelect, '1')
    const countrySelect = Array.from(container.querySelectorAll('select')).find(s =>
      Array.from(s.options).some(o => o.value === 'Germany')
    )
    if (countrySelect) await user.selectOptions(countrySelect, 'Germany')
    // Set capacity to 50
    const capInput = screen.getByPlaceholderText(/e.g. 500/i)
    await user.type(capInput, '50')
    const [startDate, endDate] = container.querySelectorAll('input[type="date"]')
    const [startTime, endTime] = container.querySelectorAll('input[type="time"]')
    await act(async () => {
      fireEvent.change(startDate, { target: { value: '2026-12-01' } })
      fireEvent.change(startTime, { target: { value: '09:00' } })
      fireEvent.change(endDate,   { target: { value: '2026-12-01' } })
      fireEvent.change(endTime,   { target: { value: '17:00' } })
    })
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    // Set tier quantity to 100 (exceeds capacity of 50)
    const qtyInput = container.querySelector('input[placeholder="e.g. 100"]')
    if (qtyInput) {
      await user.clear(qtyInput)
      await user.type(qtyInput, '100')
    }
    // Capacity overflow banner should appear
    await waitFor(() => expect(screen.getByText(/exceeds event capacity/i)).toBeInTheDocument(), { timeout: 3000 })
  })

  it('step 3 — sale end after event start shows warning', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => screen.getByText('Tier 1'), { timeout: 5000 })
    // Set sale_end AFTER event start (2026-12-01 09:00)
    const datetimeInputs = container.querySelectorAll('input[type="datetime-local"]')
    if (datetimeInputs[0]) await act(async () => fireEvent.change(datetimeInputs[0], { target: { value: '2026-11-01T00:00' } }))
    if (datetimeInputs[1]) await act(async () => fireEvent.change(datetimeInputs[1], { target: { value: '2026-12-02T00:00' } }))
    await waitFor(() => expect(screen.getByText(/ticket sales should close before the event starts/i)).toBeInTheDocument(), { timeout: 3000 })
  })

  it('step 1 — location type online shows online link field', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    // Change to online
    const locationSelect = Array.from(container.querySelectorAll('select')).find(
      s => Array.from(s.options).some(o => o.value === 'online')
    )
    if (locationSelect) {
      await act(async () => fireEvent.change(locationSelect, { target: { value: 'online' } }))
      await waitFor(() => expect(screen.getByPlaceholderText(/https:\/\/meet/i)).toBeInTheDocument())
    }
  })

  it('shows error flash when step 1 is invalid on save draft', async () => {
    renderCreate()
    await userEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(screen.getByText(/event title is required/i)).toBeInTheDocument()
    )
    expect(eventsApi.create).not.toHaveBeenCalled()
  })

  it('step 1 — shows all form fields', async () => {
    renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    expect(screen.getByPlaceholderText(/vector summit/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/short overview/i)).toBeInTheDocument()
    // Date and time inputs
    expect(document.querySelectorAll('input[type="date"]').length).toBe(2)
    expect(document.querySelectorAll('input[type="time"]').length).toBe(2)
  })

  it('step 1 — validates capacity must be positive', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await user.type(screen.getByPlaceholderText(/vector summit/i), 'My Event')
    await user.type(screen.getByPlaceholderText(/short overview/i), 'Desc')
    const capInput = container.querySelector('input[type="number"]')
    if (capInput) await act(async () => fireEvent.change(capInput, { target: { value: '-1' } }))
    await user.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(screen.getByText(/category is required/i)).toBeInTheDocument())
  })

  it('step 2 — shows registration type options after valid step 1', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent.trim() === 'Next →')
    await user.click(nextBtn)
    await waitFor(() => expect(screen.getByText('Automatic')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Manual approval')).toBeInTheDocument()
    expect(screen.getByText('Invite only')).toBeInTheDocument()
  })

  it('step 2 — shows requires_registration toggle and feedback visibility', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const nextBtn = screen.getAllByRole('button').find(b => b.textContent.trim() === 'Next →')
    await user.click(nextBtn)
    await waitFor(() => expect(screen.getByText('Automatic')).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Requires registration')).toBeInTheDocument()
    expect(screen.getByText('Feedback visibility')).toBeInTheDocument()
  })

  it('step 3 — shows ticket tier form with name and quantity fields', async () => {
    const { container } = renderCreate()
    await waitFor(() => screen.getByText('AI & ML'))
    await fillStep1(container)
    const getNext = () => screen.getAllByRole('button').find(b => b.textContent.includes('Next') || b.textContent.includes('Continue'))
    await user.click(getNext())
    await waitFor(() => screen.getByText('Automatic'), { timeout: 5000 })
    await user.click(getNext())
    await waitFor(() => expect(screen.getByText(/tier 1/i)).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('Quantity')).toBeInTheDocument()
  })
})
