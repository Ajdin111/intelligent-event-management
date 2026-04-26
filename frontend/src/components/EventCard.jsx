const IconCalendar = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="2" width="12" height="10.5" rx="1.3" />
    <line x1="0.5" y1="5" x2="12.5" y2="5" />
    <line x1="3.5" y1="0.5" x2="3.5" y2="3.5" strokeLinecap="round" />
    <line x1="9.5" y1="0.5" x2="9.5" y2="3.5" strokeLinecap="round" />
  </svg>
)

const IconPin = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2.5-3.5 7.5-3.5 7.5S3 7 3 4.5A3.5 3.5 0 0 1 6.5 1Z" strokeLinejoin="round" />
    <circle cx="6.5" cy="4.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
)

const IconPeople = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="5" cy="4" r="2.2" />
    <path d="M0.5 12c0-2.5 2-4.5 4.5-4.5S9.5 9.5 9.5 12" strokeLinecap="round" />
    <circle cx="9.5" cy="4" r="1.7" />
    <path d="M11 7.5c1.2.6 2 1.9 2 3.5" strokeLinecap="round" />
  </svg>
)

export default function EventCard({ event }) {
  return (
    <div className="event-card">
      <div className="event-card-img-wrap">
        <img src={event.image} alt={event.title} />
        {event.recommended && (
          <span className="recommended-badge">Recommended</span>
        )}
      </div>

      <div className="event-card-body">
        <p className="event-card-title">{event.title}</p>

        <div className="event-card-meta">
          <div className="event-card-row">
            <IconCalendar />
            {event.date}
          </div>
          <div className="event-card-row">
            <IconPin />
            <span className="location-badge">{event.locationType}</span>
          </div>
        </div>

        <div className="event-card-footer">
          <span>{event.ticketTier}</span>
          <span className="spots-left">
            <IconPeople />
            {event.spotsLeft} spots left
          </span>
        </div>
      </div>
    </div>
  )
}
