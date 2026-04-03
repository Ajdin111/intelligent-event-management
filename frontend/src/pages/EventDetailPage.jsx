import { useParams } from 'react-router-dom'
import Topbar from '../components/layout/Topbar'
import styles from './EventDetailPage.module.css'

const EVENT = {
  id: 1,
  title: 'AI & Machine Learning Summit 2026',
  cover_image: null,
  description:
    'Join the most anticipated AI conference of 2026. Three days of talks, workshops, and networking with the brightest minds in machine learning, LLMs, robotics, and applied AI. Whether you are a researcher, engineer, or founder — this event is built for you.',
  start_datetime: 'April 15, 2026 · 09:00',
  end_datetime: 'April 17, 2026 · 18:00',
  location_type: 'Online',
  physical_address: null,
  online_link: null,
  status: 'published',
  organizer: 'TechForward Inc.',
  capacity: 500,
  spots_left: 45,
  ticket_tiers: [
    {
      id: 1,
      name: 'Free Access',
      description: 'Watch all keynotes live. No workshop access.',
      price: 0,
      quantity: 200,
      spots_left: 80,
      is_active: true,
    },
    {
      id: 2,
      name: 'Early Bird',
      description: 'Full access to all sessions and workshops.',
      price: 49,
      quantity: 150,
      spots_left: 22,
      is_active: true,
    },
    {
      id: 3,
      name: 'VIP Pass',
      description: 'Everything in Early Bird plus speaker dinner and recordings.',
      price: 149,
      quantity: 50,
      spots_left: 8,
      is_active: true,
    },
  ],
  agenda: [
    {
      track: 'Main Stage',
      sessions: [
        { time: '09:00 – 09:45', title: 'Opening Keynote: The State of AI in 2026', speaker: 'Dr. Sarah Chen' },
        { time: '10:00 – 10:45', title: 'Large Language Models Beyond GPT', speaker: 'Amir Patel' },
        { time: '11:00 – 11:45', title: 'AI Safety — Where Are We Now?', speaker: 'Prof. James Okafor' },
      ],
    },
    {
      track: 'Workshop Track',
      sessions: [
        { time: '13:00 – 14:30', title: 'Fine-tuning LLMs on Custom Data', speaker: 'Lena Müller' },
        { time: '15:00 – 16:30', title: 'Building RAG Pipelines in Production', speaker: 'Carlos Rivera' },
      ],
    },
  ],
}

const STATUS_COLORS = {
  published: '#4ade80',
  draft:     '#facc15',
  cancelled: '#f87171',
  closed:    '#8a9399',
}

export default function EventDetailPage() {
  const { id } = useParams()
  // TODO: replace fake EVENT with api.get(`/events/${id}`) when Member 1 merges

  const event = EVENT

  return (
    <div className={styles.page}>
      <Topbar title="Event Detail" />

      <div className={styles.content}>

        {/* Cover */}
        <div className={styles.cover}>
          {event.cover_image
            ? <img src={event.cover_image} alt={event.title} className={styles.coverImg} />
            : <div className={styles.coverPlaceholder} />
          }
        </div>

        <div className={styles.body}>

          {/* Left column */}
          <div className={styles.left}>

            {/* Header */}
            <div className={styles.header}>
              <div className={styles.statusRow}>
                <span
                  className={styles.statusDot}
                  style={{ background: STATUS_COLORS[event.status] ?? '#8a9399' }}
                />
                <span className={styles.statusLabel}>{event.status}</span>
                <span className={styles.locationTag}>{event.location_type}</span>
              </div>
              <h1 className={styles.title}>{event.title}</h1>
              <p className={styles.organizer}>by {event.organizer}</p>
            </div>

            {/* Meta row */}
            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Start</span>
                <span className={styles.metaValue}>{event.start_datetime}</span>
              </div>
              <div className={styles.metaDivider} />
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>End</span>
                <span className={styles.metaValue}>{event.end_datetime}</span>
              </div>
              <div className={styles.metaDivider} />
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Capacity</span>
                <span className={styles.metaValue}>{event.capacity} attendees</span>
              </div>
              <div className={styles.metaDivider} />
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Spots left</span>
                <span className={styles.metaValue} style={{ color: event.spots_left < 20 ? '#f87171' : 'inherit' }}>
                  {event.spots_left}
                </span>
              </div>
            </div>

            {/* Description */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>About</h2>
              <p className={styles.description}>{event.description}</p>
            </section>

            {/* Agenda */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Agenda</h2>
              <div className={styles.agenda}>
                {event.agenda.map((track) => (
                  <div key={track.track} className={styles.track}>
                    <p className={styles.trackName}>{track.track}</p>
                    <div className={styles.sessions}>
                      {track.sessions.map((s) => (
                        <div key={s.title} className={styles.session}>
                          <span className={styles.sessionTime}>{s.time}</span>
                          <div className={styles.sessionInfo}>
                            <span className={styles.sessionTitle}>{s.title}</span>
                            <span className={styles.sessionSpeaker}>{s.speaker}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* Right column — ticket tiers */}
          <div className={styles.right}>
            <div className={styles.tiersCard}>
              <p className={styles.tiersHeading}>Ticket Tiers</p>
              <div className={styles.tiers}>
                {event.ticket_tiers.map((tier) => (
                  <div key={tier.id} className={styles.tier}>
                    <div className={styles.tierHeader}>
                      <span className={styles.tierName}>{tier.name}</span>
                      <span className={styles.tierPrice}>
                        {tier.price === 0 ? 'Free' : `$${tier.price}`}
                      </span>
                    </div>
                    <p className={styles.tierDesc}>{tier.description}</p>
                    <div className={styles.tierFooter}>
                      <span className={styles.tierSpots}>
                        {tier.spots_left} spots left
                      </span>
                      <button
                        className={styles.registerBtn}
                        disabled={!tier.is_active || tier.spots_left === 0}
                      >
                        {tier.spots_left === 0 ? 'Sold out' : 'Register'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}