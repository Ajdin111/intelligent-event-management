import EventCard from '../components/EventCard'
import { currentUser, upcomingEvents, recommendedEvents } from '../data/fakeData'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  return (
    <div>
      <h1 className="page-greeting">
        {getGreeting()}, {currentUser.name}
      </h1>

      <section className="section">
        <h2 className="section-title">Your Upcoming Events</h2>
        <div className="events-grid">
          {upcomingEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
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
