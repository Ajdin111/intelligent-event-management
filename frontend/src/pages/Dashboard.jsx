import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import EventCard from '../components/EventCard'
import { recommendedEvents } from '../data/fakeData'
import { useAuth } from '../context/AuthContext'
import { registrationsApi, eventsApi } from '../services/api'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function toCardShape(event) {
  const locationType =
    event.location_type === 'online' ? 'Online' :
    event.location_type === 'hybrid' ? 'Hybrid' :
    event.physical_address || 'In-person'
  return {
    id: event.id,
    title: event.title,
    date: fmtDate(event.start_datetime),
    locationType,
    ticketTier: event.is_free ? 'Free' : 'Paid',
    spotsLeft: event.capacity ?? '∞',
    cover_image: event.cover_image || null,
    image: `https://picsum.photos/seed/ev${event.id}/600/340`,
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const regsRes = await registrationsApi.getMine()
        const active = regsRes.data.filter(r => r.status === 'confirmed' || r.status === 'pending')
        if (active.length === 0) { setLoading(false); return }

        const now = new Date()
        const events = await Promise.all(
          active.map(r => eventsApi.getById(r.event_id).then(res => res.data).catch(() => null))
        )
        const upcoming = events
          .filter(e => e && new Date(e.start_datetime) > now)
          .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))

        setUpcomingEvents(upcoming.map(toCardShape))
      } catch {
        // silently degrade — empty state shown below
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const firstName = user?.first_name ?? 'there'

  return (
    <div>
      <h1 className="page-greeting">
        {getGreeting()}, {firstName}
      </h1>

      <section className="section">
        <h2 className="section-title">Your Upcoming Events</h2>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : upcomingEvents.length === 0 ? (
          <div className="dashboard-empty-state">
            <p className="dashboard-empty-msg">You have no upcoming events.</p>
            <Link to="/events" className="btn-outline-sm">Browse events</Link>
          </div>
        ) : (
          <div className="events-grid">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">AI Recommended Events</h2>
        <div className="events-grid-2">
          {recommendedEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </div>
  )
}
