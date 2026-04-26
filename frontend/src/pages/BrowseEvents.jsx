import { useState, useEffect, useMemo } from 'react'
import { eventsApi, categoriesApi } from '../services/api'

// Fallback data — matches EventResponse shape + display-only fields
const FAKE_EVENTS = [
  { id: 9, title: 'Model Eval Workshop', organizer: 'Northwind Labs', location_type: 'online', physical_address: null, start_datetime: '2026-10-01T09:00:00', is_free: false, price: 99, capacity: 800, spotsLeft: 520, category: 'AI & ML', code: 'E9', status: 'published' },
  { id: 5, title: 'Warehouse & Lakehouse Days', organizer: 'Stratus Data', location_type: 'physical', physical_address: 'New York, NY', start_datetime: '2026-07-15T09:00:00', is_free: false, price: 349, capacity: 500, spotsLeft: 210, category: 'Data', code: 'E5', status: 'published' },
  { id: 8, title: 'Interface 2026', organizer: 'Studio Kilo', location_type: 'physical', physical_address: 'Amsterdam, NL', start_datetime: '2026-09-09T09:00:00', is_free: false, price: 399, capacity: 300, spotsLeft: 74, category: 'Design', code: 'E8', status: 'published' },
  { id: 1, title: 'Vector Summit 2026', organizer: 'Northwind Labs', location_type: 'physical', physical_address: 'San Francisco, CA', start_datetime: '2026-05-14T09:00:00', is_free: false, price: 199, capacity: 600, spotsLeft: 412, category: 'AI & ML', code: 'E1', status: 'published' },
  { id: 4, title: 'EdgeCloud Conf', organizer: 'Helix Platform', location_type: 'physical', physical_address: 'Austin, TX', start_datetime: '2026-06-03T09:00:00', is_free: false, price: 249, capacity: 400, spotsLeft: 88, category: 'Cloud', code: 'E4', status: 'published' },
  { id: 2, title: 'ReactNext: Motion', organizer: 'Parallel', location_type: 'physical', physical_address: 'Berlin, DE', start_datetime: '2026-06-18T09:00:00', is_free: true, price: 0, capacity: 250, spotsLeft: 22, category: 'Frontend', code: 'E2', status: 'published' },
  { id: 7, title: 'ZeroTrust World', organizer: 'Aegis Security', location_type: 'online', physical_address: null, start_datetime: '2026-07-02T09:00:00', is_free: false, price: 149, capacity: 2000, spotsLeft: 1240, category: 'Security', code: 'E7', status: 'published' },
  { id: 6, title: 'PlatformCon', organizer: 'Runbook', location_type: 'online', physical_address: null, start_datetime: '2026-08-05T09:00:00', is_free: false, price: 249, capacity: 350, spotsLeft: 156, category: 'DevOps', code: 'E6', status: 'published' },
  { id: 3, title: 'Product Craft Summit', organizer: 'Orbit', location_type: 'physical', physical_address: 'Toronto, CA', start_datetime: '2026-08-22T09:00:00', is_free: true, price: 0, capacity: 400, spotsLeft: 340, category: 'Product', code: 'E3', status: 'published' },
]

const FAKE_CATEGORIES = ['AI & ML', 'Cloud', 'Frontend', 'Security', 'Data', 'DevOps', 'Product', 'Design']
const FILTER_DATES = ['Anytime', 'This week', 'This month', 'Next 3 months']

function getLocation(event) {
  if (event.location_type === 'online') return 'Remote'
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
    const end = new Date(now); end.setDate(now.getDate() + 7)
    return d >= now && d <= end
  }
  if (filter === 'This month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }
  if (filter === 'Next 3 months') {
    const end = new Date(now); end.setMonth(now.getMonth() + 3)
    return d >= now && d <= end
  }
  return true
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

function DiscoverCard({ event }) {
  const location = getLocation(event)
  const date = formatDate(event.start_datetime)
  const priceLabel = event.is_free || event.price === 0 ? 'Free' : `$${event.price}`

  return (
    <div className="discover-card">
      <div className="discover-card-cover">
        <span className="discover-card-category">{event.category}</span>
        <span className="discover-card-price">{priceLabel}</span>
        <span className="discover-card-code">EVENT · {event.code}</span>
      </div>
      <div className="discover-card-body">
        <p className="discover-card-title">{event.title}</p>
        <p className="discover-card-organizer">{event.organizer}</p>
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
            <strong>{event.spotsLeft?.toLocaleString()}</strong> spots left
          </span>
          <button className="discover-register-btn">
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
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedLocation, setSelectedLocation] = useState('All')
  const [selectedDate, setSelectedDate] = useState('Anytime')
  const [maxPrice, setMaxPrice] = useState(500)

  useEffect(() => {
    Promise.all([
      eventsApi.list({ limit: 100 }),
      categoriesApi.list(),
    ])
      .then(([eventsRes, catsRes]) => {
        const items = eventsRes.data.items
        setEvents(items.length > 0 ? items : FAKE_EVENTS)

        const catNames = catsRes.data.map((c) => c.name)
        setCategories(catNames.length > 0 ? catNames : FAKE_CATEGORIES)
      })
      .catch(() => {
        setEvents(FAKE_EVENTS)
        setCategories(FAKE_CATEGORIES)
      })
      .finally(() => setLoading(false))
  }, [])

  const locations = useMemo(() => {
    const locs = ['All', ...new Set(events.map(getLocation).filter(Boolean))]
    return locs
  }, [events])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const cat = e.category || ''
      const loc = getLocation(e)
      const price = e.price ?? 0
      const matchSearch = !query || e.title.toLowerCase().includes(query.toLowerCase()) || (e.organizer || '').toLowerCase().includes(query.toLowerCase())
      const matchCat = selectedCategory === 'All' || cat.toLowerCase() === selectedCategory.toLowerCase()
      const matchLoc = selectedLocation === 'All' || loc === selectedLocation
      const matchDate = isWithinDate(e.start_datetime, selectedDate)
      const matchPrice = price <= maxPrice
      return matchSearch && matchCat && matchLoc && matchDate && matchPrice
    })
  }, [events, query, selectedCategory, selectedLocation, selectedDate, maxPrice])

  const resetFilters = () => {
    setSelectedCategory('All')
    setSelectedLocation('All')
    setSelectedDate('Anytime')
    setMaxPrice(500)
    setSearchInput('')
    setQuery('')
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') setQuery(searchInput)
  }

  return (
    <div className="discover-layout">
      {/* Filter Panel */}
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
              {cat}
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
              {loc}
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
              {d}
            </label>
          ))}
        </div>

        <div className="filter-section">
          <p className="filter-section-label">PRICE</p>
          <div className="filter-price-row">
            <span>$0</span>
            <span>Up to ${maxPrice}</span>
          </div>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="filter-range"
          />
          <button className="filter-reset-btn" onClick={resetFilters}>Reset</button>
        </div>
      </aside>

      {/* Main Content */}
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
              placeholder="Search events, organizers…"
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
              <DiscoverCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
