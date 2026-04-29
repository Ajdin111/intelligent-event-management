import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventsApi, categoriesApi, ticketTiersApi } from '../services/api'

const FILTER_DATES = ['Anytime', 'This week', 'This month', 'Next 3 months']
const MAX_PRICE = 500

function getLocation(event) {
  if (event.location_type === 'online') return 'Remote'
  if (event.location_type === 'hybrid') {
    return event.physical_address ? `${event.physical_address} + Online` : 'Hybrid'
  }
  if (event.physical_address) return event.physical_address
  return 'TBA'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isWithinDate(iso, filter) {
  if (filter === 'Anytime') return true
  const d = new Date(iso)
  const now = new Date()
  if (filter === 'This week') {
    const end = new Date(now)
    end.setDate(now.getDate() + 7)
    return d >= now && d <= end
  }
  if (filter === 'This month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  if (filter === 'Next 3 months') {
    const end = new Date(now)
    end.setMonth(now.getMonth() + 3)
    return d >= now && d <= end
  }
  return true
}

function getEventPrice(event) {
  if (event.is_free) return 0
  if (event.lowestTicketPrice == null) return Number.POSITIVE_INFINITY
  return event.lowestTicketPrice
}

function formatPriceLabel(event) {
  if (event.is_free || event.lowestTicketPrice === 0) return 'Free'
  if (event.lowestTicketPrice == null) return 'TBA'
  return `$${event.lowestTicketPrice}`
}


function normalizeEvent(event, categoryMap, ticketTiers) {
  const prices = (ticketTiers ?? [])
    .filter((tier) => tier.is_active)
    .map((tier) => Number(tier.price))
    .filter((price) => Number.isFinite(price))

  const lowestTicketPrice = prices.length > 0 ? Math.min(...prices) : null
  const primaryCategoryId = event.category_ids?.[0]
  const category = primaryCategoryId ? categoryMap.get(primaryCategoryId) : null

  return {
    ...event,
    category: category ?? 'Uncategorized',
    code: `E${event.id}`,
    lowestTicketPrice,
    spotsLeft: event.capacity ?? null,
  }
}

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="4.5" />
    <line x1="9.5" y1="9.5" x2="13" y2="13" strokeLinecap="round" />
  </svg>
)

const IconArrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="2" y1="6" x2="10" y2="6" strokeLinecap="round" />
    <path d="M7 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function DiscoverCard({ event, onNavigate }) {
  const location = getLocation(event)
  const date = formatDate(event.start_datetime)
  const priceLabel = formatPriceLabel(event)

  return (
    <div className="discover-card" onClick={() => onNavigate(event.id)} style={{ cursor: 'pointer' }}>
      <div className="discover-card-cover">
        <span className="discover-card-category">{event.category}</span>
        <span className="discover-card-price">{priceLabel}</span>
        <span className="discover-card-code">EVENT · {event.code}</span>
      </div>
      <div className="discover-card-body">
        <p className="discover-card-title">{event.title}</p>
        {event.online_link && (
          <p className="discover-card-organizer">Online registration available</p>
        )}
        <div className="discover-card-meta">
          <span className="discover-card-date">
            <IconCalSmall /> {date}
          </span>
          <span className="discover-card-loc">
            <IconPinSmall /> {location}
          </span>
        </div>
        <div className="discover-card-footer">
          <span className="discover-card-spots">
            <strong>{event.spotsLeft?.toLocaleString() ?? 'Open'}</strong>{' '}
            {event.spotsLeft == null ? 'capacity' : 'spots left'}
          </span>
          <button
            className="discover-register-btn"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(event.id)
            }}
          >
            Register <IconArrow />
          </button>
        </div>
      </div>
    </div>
  )
}

const IconCalSmall = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="11" height="10" rx="1.2" />
    <line x1="0.5" y1="4.5" x2="11.5" y2="4.5" />
    <line x1="3.5" y1="0" x2="3.5" y2="3" strokeLinecap="round" />
    <line x1="8.5" y1="0" x2="8.5" y2="3" strokeLinecap="round" />
  </svg>
)

const IconPinSmall = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 6.5-3 6.5S3 6.5 3 4a3 3 0 0 1 3-3Z" strokeLinejoin="round" />
    <circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="1" y1="3" x2="13" y2="3" strokeLinecap="round" />
    <line x1="3" y1="7" x2="11" y2="7" strokeLinecap="round" />
    <line x1="5" y1="11" x2="9" y2="11" strokeLinecap="round" />
  </svg>
)

export default function BrowseEvents() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedLocation, setSelectedLocation] = useState('All')
  const [selectedDate, setSelectedDate] = useState('Anytime')
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE)

  useEffect(() => {
    let isActive = true

    async function loadDiscoverData() {
      try {
        const [eventsRes, catsRes] = await Promise.all([
          eventsApi.list({ limit: 100 }),
          categoriesApi.list(),
        ])

        const eventItems = eventsRes.data?.items ?? []
        const categoryItems = catsRes.data ?? []
        const categoryMap = new Map(categoryItems.map((category) => [category.id, category.name]))

        const ticketTierResults = await Promise.all(
          eventItems.map((event) =>
            ticketTiersApi
              .listByEvent(event.id)
              .then((res) => [event.id, res.data ?? []])
              .catch(() => [event.id, []])
          )
        )

        if (!isActive) return

        const ticketTierMap = new Map(ticketTierResults)
        const normalizedEvents = eventItems.map((event) =>
          normalizeEvent(event, categoryMap, ticketTierMap.get(event.id))
        )

        setEvents(normalizedEvents)
        setCategories(categoryItems.map((category) => category.name))
      } catch {
        if (!isActive) return
        setEvents([])
        setCategories([])
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    loadDiscoverData()

    return () => {
      isActive = false
    }
  }, [])

  const locations = useMemo(() => {
    return ['All', ...new Set(events.map(getLocation).filter(Boolean))]
  }, [events])

  const filtered = useMemo(() => {
    return events.filter((event) => {
      const price = getEventPrice(event)
      const matchSearch =
        !query || event.title.toLowerCase().includes(query.toLowerCase())
      const matchCat =
        selectedCategory === 'All' || event.category.toLowerCase() === selectedCategory.toLowerCase()
      const matchLoc = selectedLocation === 'All' || getLocation(event) === selectedLocation
      const matchDate = isWithinDate(event.start_datetime, selectedDate)
      const matchPrice =
        maxPrice === MAX_PRICE
          ? true
          : price <= maxPrice

      return matchSearch && matchCat && matchLoc && matchDate && matchPrice
    })
  }, [events, query, selectedCategory, selectedLocation, selectedDate, maxPrice])

  const resetFilters = () => {
    setSelectedCategory('All')
    setSelectedLocation('All')
    setSelectedDate('Anytime')
    setMaxPrice(MAX_PRICE)
    setSearchInput('')
    setQuery('')
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') setQuery(searchInput)
  }

  return (
    <div className="discover-layout">
      <aside className="filter-panel">
        <div className="filter-panel-header">
          <IconFilter />
          <span>Filters</span>
        </div>

        <div className="filter-section">
          <p className="filter-section-label">CATEGORY</p>
          {['All', ...categories].map((cat) => (
            <label key={cat} className="filter-radio">
              <input
                type="radio"
                name="category"
                checked={selectedCategory === cat}
                onChange={() => setSelectedCategory(cat)}
              />
              <span className="filter-radio-label">{cat}</span>
            </label>
          ))}
        </div>

        <div className="filter-section">
          <p className="filter-section-label">LOCATION</p>
          {locations.map((loc) => (
            <label key={loc} className="filter-radio">
              <input
                type="radio"
                name="location"
                checked={selectedLocation === loc}
                onChange={() => setSelectedLocation(loc)}
              />
              <span className="filter-radio-label">{loc}</span>
            </label>
          ))}
        </div>

        <div className="filter-section">
          <p className="filter-section-label">DATE</p>
          {FILTER_DATES.map((d) => (
            <label key={d} className="filter-radio">
              <input
                type="radio"
                name="date"
                checked={selectedDate === d}
                onChange={() => setSelectedDate(d)}
              />
              <span className="filter-radio-label">{d}</span>
            </label>
          ))}
        </div>

        <div className="filter-section">
          <p className="filter-section-label">PRICE</p>
          <div className="filter-price-row">
            <span>$0</span>
            <span>{maxPrice === 0 ? 'Free only' : `Up to $${maxPrice}`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={MAX_PRICE}
            step={10}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="filter-range"
          />
          <button className="filter-reset-btn" onClick={resetFilters}>Reset</button>
        </div>
      </aside>

      <div className="discover-content">
        <div className="discover-top">
          <div>
            <h1 className="discover-heading">Discover events</h1>
            <p className="discover-sub">
              {loading
                ? 'Loading…'
                : `${filtered.length} event${filtered.length !== 1 ? 's' : ''} match your filters${query ? ` for "${query}"` : ''}.`}
            </p>
          </div>
          <div className="discover-search-wrap">
            <IconSearch />
            <input
              type="text"
              placeholder="Search events…"
              className="discover-search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                if (e.target.value === '') setQuery('')
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
        </div>

        {loading ? (
          <div className="discover-empty">Loading events…</div>
        ) : filtered.length === 0 ? (
          <div className="discover-empty">No events match your filters.</div>
        ) : (
          <div className="discover-grid">
            {filtered.map((event) => (
              <DiscoverCard key={event.id} event={event} onNavigate={(id) => navigate(`/events/${id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
