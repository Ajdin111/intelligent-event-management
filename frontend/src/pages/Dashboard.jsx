import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import EventCard from '../components/EventCard'
import { useAuth } from '../context/AuthContext'
import { mlApi, eventsApi, registrationsApi, categoriesApi } from '../services/api'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function toCardShape(event, opts = {}) {
  const loc =
    event.location_type === 'online'  ? 'Online'
    : event.location_type === 'hybrid' ? 'Hybrid'
    : event.physical_address           ? event.physical_address
    : 'In-person'

  return {
    id:           event.id,
    title:        event.title,
    date:         fmtDate(event.start_datetime),
    locationType: loc,
    ticketTier:   event.is_free ? 'Free' : 'Paid',
    spotsLeft:    event.capacity ?? '—',
    category:     opts.categoryMap?.get(event.category_ids?.[0]) ?? null,
    image:        event.cover_image || `https://picsum.photos/seed/${event.id}/600/340`,
  }
}

function CardSkeleton() {
  return (
    <div className="event-card event-card--skeleton" aria-hidden="true">
      <div className="event-card-img-wrap" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <div className="event-card-body" style={{ gap: 8 }}>
        <div style={{ height: 16, width: '70%', background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
        <div style={{ height: 12, width: '50%', background: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [upcomingEvents, setUpcomingEvents]       = useState([])
  const [loadingUpcoming, setLoadingUpcoming]     = useState(true)
  const [recommendedEvents, setRecommendedEvents] = useState([])
  const [loadingRecs, setLoadingRecs]             = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchAll() {
      try {
        const [regsRes, recsRes, catsRes] = await Promise.all([
          registrationsApi.getMine(),
          mlApi.recommendations(),
          categoriesApi.list(),
        ])

        const categoryMap = new Map((catsRes.data ?? []).map(c => [c.id, c.name]))
        const allRegs = regsRes.data ?? []
        const registeredIds = new Set(allRegs.map(r => r.event_id))
        const confirmed = allRegs.filter(r => r.status === 'confirmed')
        const recs = recsRes.data ?? []

        const now = Date.now()

        // upcoming: 3 soonest confirmed future events
        const upcomingSettled = await Promise.allSettled(
          confirmed.map(r => eventsApi.getById(r.event_id).then(res => res.data))
        )
        const future = upcomingSettled
          .filter(s => s.status === 'fulfilled')
          .map(s => s.value)
          .filter(e => new Date(e.start_datetime).getTime() > now)
          .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
          .slice(0, 3)
          .map(e => toCardShape(e, { categoryMap }))

        // recommendations: top 9, excluding already-registered events
        const filteredRecs = recs.filter(r => !registeredIds.has(r.event_id))
        const recsSettled = await Promise.allSettled(
          filteredRecs.map(r => eventsApi.getById(r.event_id).then(res => res.data))
        )
        const cards = recsSettled
          .filter(s => s.status === 'fulfilled')
          .map(s => toCardShape(s.value, { categoryMap }))
          .slice(0, 9)

        if (!cancelled) {
          setUpcomingEvents(future)
          setRecommendedEvents(cards)
        }
      } catch {
        if (!cancelled) {
          setUpcomingEvents([])
          setRecommendedEvents([])
        }
      } finally {
        if (!cancelled) {
          setLoadingUpcoming(false)
          setLoadingRecs(false)
        }
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [])

  const firstName = user?.first_name ?? 'there'

  return (
    <div>
      <h1 className="page-greeting">
        {getGreeting()}, {firstName}
      </h1>

      <section className="section">
        <h2 className="section-title">Your Upcoming Events</h2>
        {loadingUpcoming ? (
          <div className="events-grid">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="dashboard-empty-state">
            <p className="dashboard-empty-msg">You have no upcoming events.</p>
            <Link to="/events" className="btn-outline-sm">Browse events</Link>
          </div>
        ) : (
          <div className="events-grid">
            {upcomingEvents.map(event => (
              <EventCard key={event.id} event={event} from="/dashboard" />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">AI Recommended Events</h2>
        {loadingRecs ? (
          <div className="events-grid">
            {[1, 2].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : recommendedEvents.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 8 }}>
            No recommendations yet. Register for more events to get personalised suggestions.
          </p>
        ) : (
          <div className="events-grid">
            {recommendedEvents.map(event => (
              <EventCard key={event.id} event={event} from="/dashboard" />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
