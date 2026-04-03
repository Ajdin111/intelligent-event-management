import { useState, useMemo } from 'react'
import Topbar from '../components/layout/Topbar'
import EventCard from '../components/ui/EventCard'
import styles from './BrowseEventsPage.module.css'

// TODO: replace with api.get('/events') when Member 1's Events API is merged
const ALL_EVENTS = [
  { id: 1, title: 'AI & Machine Learning Summit 2026', date: 'April 15, 2026', location_type: 'Online',   ticket_tier: 'VIP Pass',   spots_left: 45 },
  { id: 2, title: 'Global Tech Conference',            date: 'May 8, 2026',    location_type: 'Physical', physical_address: 'San Francisco, CA', ticket_tier: 'Early Bird', spots_left: 120 },
  { id: 3, title: 'Startup Ecosystem Workshop',        date: 'June 2, 2026',   location_type: 'Hybrid',   ticket_tier: 'Standard',   spots_left: 32 },
  { id: 4, title: 'Code & Hardware Expo',              date: 'Jul 14, 2026',   location_type: 'Physical', ticket_tier: 'General',    spots_left: 80 },
  { id: 5, title: 'Mathematical Workshop',             date: 'Aug 3, 2026',    location_type: 'Online',   ticket_tier: 'Free',       spots_left: null },
]

const FILTERS = ['All', 'Online', 'Physical', 'Hybrid']

export default function BrowseEventsPage() {
  const [search, setSearch]       = useState('')
  const [activeFilter, setFilter] = useState('All')

  const filtered = useMemo(() => {
    return ALL_EVENTS.filter((e) => {
      const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase())
      const matchesFilter = activeFilter === 'All' || e.location_type === activeFilter
      return matchesSearch && matchesFilter
    })
  }, [search, activeFilter])

  return (
    <div className={styles.page}>
      <Topbar title="Browse Events" />
      <div className={styles.content}>

        {/* Search + Filters */}
        <div className={styles.toolbar}>
          <input
            className="input"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />
          <div className={styles.filters}>
            {FILTERS.map((f) => (
              <button
                key={f}
                className={activeFilter === f ? styles.filterActive : styles.filter}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <p className={styles.count}>
          Showing {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Grid or Empty state */}
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No events found</p>
            <p className={styles.emptySub}>Try a different search term or filter</p>
          </div>
        )}

      </div>
    </div>
  )
}