import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { eventsApi } from '../services/api'

// Category → Unsplash cover image
const COVERS = {
  'AI & ML':  'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=1600&q=80',
  'Data':     'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',
  'Frontend': 'https://images.unsplash.com/photo-1593720219276-0b1eacd0aef4?auto=format&fit=crop&w=1600&q=80',
  'Cloud':    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1600&q=80',
  'Security': 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1600&q=80',
  'DevOps':   'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?auto=format&fit=crop&w=1600&q=80',
  'Product':  'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1600&q=80',
  'Design':   'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1600&q=80',
  default:    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80',
}

// Fake enriched detail per event id (fills in what the bare EventResponse doesn't carry)
const FAKE = {
  1: {
    category: 'AI & ML', organizer: 'Northwind Labs',
    date: 'May 14, 2026', time: '09:00 – 18:00', location: 'San Francisco, CA',
    rating: 4.7, reviewCount: 234,
    description: 'Two days of hands-on sessions on embeddings, retrieval, and agentic workflows from teams shipping in production. Expect technical keynotes from practitioners shipping at scale, five workshop tracks with live labs, and a curated networking reception on the evening of day one.\n\nAll ticket tiers include access to the main stage, workshop tracks, lunch on both days, and a post-event video library.',
    tiers: [
      { name: 'Community',  price: 0,   total: 150, sold: 128 },
      { name: 'Standard',   price: 199, total: 300, sold: 210 },
      { name: 'Early Bird', price: 149, total: 200, sold: 200 },
      { name: 'VIP',        price: 599, total: 50,  sold: 14  },
    ],
    tracks: [
      { name: 'Main Stage', sessions: [
        { time: '09:00', title: 'Opening Keynote: Retrieval in 2026', speaker: 'D. Park',     room: 'Hall A', duration: '45m' },
        { time: '10:00', title: "Evals that don't lie",               speaker: 'M. Osei',    room: 'Hall A', duration: '45m' },
        { time: '11:00', title: 'Panel: Agent architectures',         speaker: '4 speakers', room: 'Hall A', duration: '60m' },
        { time: '14:00', title: 'Fireside: Post-transformer?',        speaker: 'R. Lim',     room: 'Hall A', duration: '45m' },
      ]},
      { name: 'Workshop Track', sessions: [
        { time: '10:00', title: 'Hands-on: RAG pipelines',      speaker: 'S. Novak',    room: 'Lab 1', duration: '90m' },
        { time: '13:00', title: 'Hands-on: Evaluation harness', speaker: 'J. Tran',     room: 'Lab 1', duration: '90m' },
        { time: '15:00', title: 'Building tool-using agents',   speaker: 'A. Ferreira', room: 'Lab 2', duration: '60m' },
      ]},
      { name: 'Community', sessions: [
        { time: '11:30', title: 'Lightning talks (block 1)', speaker: '6 speakers', room: 'Hall B',  duration: '30m' },
        { time: '15:30', title: 'Lightning talks (block 2)', speaker: '6 speakers', room: 'Hall B',  duration: '30m' },
        { time: '17:00', title: 'Networking reception',      speaker: 'Open',       room: 'Atrium', duration: '60m' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 72 }, { stars: 4, pct: 20 },
      { stars: 3, pct: 5  }, { stars: 2, pct: 2  }, { stars: 1, pct: 1 },
    ],
    reviews: [
      { id: 1, rating: 5, text: "Strongest line-up I've seen this year. Workshops actually went deep.", date: '3 days ago' },
      { id: 2, rating: 4, text: 'Great sessions; registration queue was long on day one.',              date: '4 days ago' },
      { id: 3, rating: 5, text: 'The eval workshop alone was worth the ticket.',                        date: '6 days ago' },
      { id: 4, rating: 2, text: 'Content solid, catering was mid. Please more tea.',                   date: '1 week ago' },
    ],
  },
  2: {
    category: 'Frontend', organizer: 'Parallel',
    date: 'Jun 18, 2026', time: '09:30 – 16:30', location: 'Berlin, DE',
    rating: 4.5, reviewCount: 89,
    description: 'A full day of React-focused sessions covering animation, state management, and the latest patterns emerging from the ecosystem. Hands-on workshops with real project reviews and live Q&A with open-source maintainers.',
    tiers: [
      { name: 'Community', price: 0,  total: 250, sold: 228 },
      { name: 'Workshop',  price: 79, total: 80,  sold: 60  },
    ],
    tracks: [
      { name: 'Main Track', sessions: [
        { time: '09:30', title: 'The Motion API in 2026',          speaker: 'K. Laurent', room: 'Stage A', duration: '45m' },
        { time: '10:30', title: 'Server Components in production',  speaker: 'J. Chen',   room: 'Stage A', duration: '45m' },
        { time: '14:00', title: 'Panel: State in 2026',            speaker: '3 speakers', room: 'Stage A', duration: '60m' },
      ]},
    ],
    breakdown: [
      { stars: 5, pct: 60 }, { stars: 4, pct: 25 },
      { stars: 3, pct: 10 }, { stars: 2, pct: 3  }, { stars: 1, pct: 2 },
    ],
    reviews: [
      { id: 1, rating: 5, text: 'Best frontend conf I have attended. Every talk was directly applicable.', date: '2 days ago' },
      { id: 2, rating: 4, text: 'Great vibe, loved the live coding sessions.',                             date: '5 days ago' },
    ],
  },
}

function getFake(id) {
  return FAKE[id] ?? {
    category: 'Tech', organizer: 'TeqEvent',
    date: 'TBD', time: 'TBD', location: 'TBD',
    rating: 4.2, reviewCount: 12,
    description: 'Full event details will be published soon.',
    tiers: [{ name: 'Standard', price: 99, total: 200, sold: 80 }],
    tracks: [],
    breakdown: [
      { stars: 5, pct: 50 }, { stars: 4, pct: 30 },
      { stars: 3, pct: 12 }, { stars: 2, pct: 5 }, { stars: 1, pct: 3 },
    ],
    reviews: [],
  }
}

// ── icons ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoCal = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="12" height="11" rx="1.3" />
    <line x1="0.5" y1="5" x2="12.5" y2="5" />
    <line x1="3.5" y1="0" x2="3.5" y2="3" strokeLinecap="round" />
    <line x1="9.5" y1="0" x2="9.5" y2="3" strokeLinecap="round" />
  </svg>
)
const IcoClock = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="6.5" cy="6.5" r="6" />
    <path d="M6.5 3.5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoPin = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2.5-3.5 7.5-3.5 7.5S3 7 3 4.5A3.5 3.5 0 0 1 6.5 1Z" strokeLinejoin="round" />
    <circle cx="6.5" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
const IcoGroup = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="5" cy="4" r="2.2" />
    <path d="M0.5 12c0-2.5 2-4.5 4.5-4.5S9.5 9.5 9.5 12" strokeLinecap="round" />
    <circle cx="9.5" cy="4" r="1.7" />
    <path d="M11 7.5c1.2.6 2 1.9 2 3.5" strokeLinecap="round" />
  </svg>
)
const IcoSave = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 1l1.8 3.5 3.7.5-2.7 2.7.6 3.8L7 9.5l-3.4 2 .6-3.8L1.5 5l3.7-.5z" strokeLinejoin="round" />
  </svg>
)
const IcoShare = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M10 1l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
  </svg>
)

function StarRow({ rating, size = 13 }) {
  return (
    <span className="ed-stars">
      {[1,2,3,4,5].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 13 13"
          fill={n <= Math.round(rating) ? '#ffffff' : 'none'}
          stroke="currentColor" strokeWidth="1.3">
          <path d="M6.5 1l1.5 3 3.5.5-2.5 2.5.5 3.5L6.5 9l-3 1.5.5-3.5L1.5 4.5 5 4z"
            strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}

// ── component ──────────────────────────────────────────────────────────────

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTier, setSelectedTier] = useState(0)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const fake = getFake(Number(id))
    eventsApi.getById(id)
      .then(res => {
        const real = res.data
        setEvent({
          ...fake,
          title: real.title || fake.title,
          description: real.description || fake.description,
          location: real.physical_address
            || (real.location_type === 'online' ? 'Remote' : fake.location),
          date: real.start_datetime
            ? new Date(real.start_datetime).toLocaleDateString('en-US',
                { month: 'long', day: 'numeric', year: 'numeric' })
            : fake.date,
        })
      })
      .catch(() => setEvent(fake))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="ed-state">Loading…</div>
  if (!event)  return <div className="ed-state">Event not found.</div>

  const cover   = COVERS[event.category] || COVERS.default
  const tier    = event.tiers[selectedTier]
  const soldOut = tier && tier.sold >= tier.total
  const subtotal = tier
    ? (tier.price === 0 ? 'Free' : `$${(tier.price * quantity).toLocaleString()}`)
    : '—'

  return (
    <div className="ed-wrap">

      {/* back */}
      <button className="ed-back" onClick={() => navigate('/events')}>
        <IcoBack /> Back to discover
      </button>

      {/* hero */}
      <div className="ed-hero">
        <img src={cover} alt={event.title} className="ed-hero-img" />
        <div className="ed-hero-overlay" />
      </div>

      {/* meta bar */}
      <div className="ed-meta-bar">
        <div className="ed-meta-left">
          <span className="ed-cat-pill">{event.category}</span>
          <div className="ed-rating-row">
            <StarRow rating={event.rating} />
            <span className="ed-rating-val">{event.rating}</span>
            <span className="ed-rating-count">· {event.reviewCount} reviews</span>
          </div>
        </div>
        <div className="ed-actions">
          <button className="ed-action-btn"><IcoSave /> Save</button>
          <button className="ed-action-btn"><IcoShare /> Share</button>
        </div>
      </div>

      {/* title */}
      <h1 className="ed-title">{event.title}</h1>

      {/* info row */}
      <div className="ed-info-row">
        <span className="ed-info-item"><IcoCal />  {event.date}</span>
        <span className="ed-info-item"><IcoClock /> {event.time}</span>
        <span className="ed-info-item"><IcoPin />   {event.location}</span>
        <span className="ed-info-item"><IcoGroup /> Hosted by {event.organizer}</span>
      </div>

      {/* two-column body */}
      <div className="ed-body">

        {/* ── left column ── */}
        <div className="ed-main">

          {/* about */}
          <section className="ed-section">
            <h2 className="ed-section-h">About this event</h2>
            {event.description.split('\n\n').map((p, i) => (
              <p key={i} className="ed-desc">{p}</p>
            ))}
          </section>

          {/* agenda */}
          {event.tracks.length > 0 && (
            <section className="ed-section">
              <h2 className="ed-section-h">Agenda</h2>
              <div className="ed-tracks">
                {event.tracks.map(track => (
                  <div key={track.name} className="ed-track">
                    <div className="ed-track-head">
                      <span className="ed-track-bar" />
                      <span className="ed-track-name">{track.name}</span>
                      <span className="ed-track-count">· {track.sessions.length} sessions</span>
                    </div>
                    {track.sessions.map((s, i) => (
                      <div key={i} className="ed-session">
                        <span className="ed-session-time">{s.time}</span>
                        <div className="ed-session-info">
                          <span className="ed-session-title">{s.title}</span>
                          <span className="ed-session-meta">{s.speaker} · {s.room}</span>
                        </div>
                        <span className="ed-session-dur">{s.duration}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* reviews */}
          <section className="ed-section">
            <h2 className="ed-section-h">Reviews & ratings</h2>
            <div className="ed-review-summary">
              <div className="ed-score-col">
                <span className="ed-score-num">{event.rating}</span>
                <StarRow rating={event.rating} size={14} />
                <span className="ed-score-sub">{event.reviewCount} reviews</span>
              </div>
              <div className="ed-bars">
                {event.breakdown.map(r => (
                  <div key={r.stars} className="ed-bar-row">
                    <span className="ed-bar-label">{r.stars}</span>
                    <div className="ed-bar-track">
                      <div className="ed-bar-fill" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="ed-bar-pct">{r.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {event.reviews.length > 0 ? (
              <div className="ed-review-list">
                {event.reviews.map(r => (
                  <div key={r.id} className="ed-review-card">
                    <div className="ed-review-head">
                      <StarRow rating={r.rating} size={12} />
                      <span className="ed-review-date">{r.date}</span>
                    </div>
                    <p className="ed-review-text">{r.text}</p>
                    <span className="ed-review-author">Anonymous attendee</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ed-desc" style={{ marginTop: 12 }}>No reviews yet.</p>
            )}
          </section>
        </div>

        {/* ── right sidebar ── */}
        <aside className="ed-sidebar">
          <div className="ed-ticket-box">
            <p className="ed-ticket-label">CHOOSE A TIER</p>

            <div className="ed-tiers">
              {event.tiers.map((t, i) => {
                const out   = t.sold >= t.total
                const left  = t.total - t.sold
                const fill  = Math.round((t.sold / t.total) * 100)
                return (
                  <button
                    key={t.name}
                    disabled={out}
                    onClick={() => { if (!out) { setSelectedTier(i); setQuantity(1) } }}
                    className={[
                      'ed-tier',
                      selectedTier === i ? 'ed-tier--active' : '',
                      out ? 'ed-tier--soldout' : '',
                    ].join(' ')}
                  >
                    <div className="ed-tier-row">
                      <span className="ed-tier-name">{t.name}</span>
                      <span className="ed-tier-price">
                        {out ? 'Sold out' : t.price === 0 ? 'Free' : `$${t.price}`}
                      </span>
                    </div>
                    <span className="ed-tier-avail">
                      {out ? 'No spots remaining' : `${left} of ${t.total} left`}
                    </span>
                    <div className="ed-tier-track">
                      <div className="ed-tier-fill" style={{ width: `${fill}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {!soldOut && (
              <>
                <div className="ed-qty-row">
                  <span className="ed-qty-label">Quantity</span>
                  <div className="ed-qty-ctrl">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                    <span>{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)}>+</button>
                  </div>
                </div>
                <div className="ed-subtotal-row">
                  <span>Subtotal</span>
                  <strong className="ed-subtotal-val">{subtotal}</strong>
                </div>
              </>
            )}

            <button className="ed-register-btn" disabled={soldOut}>
              {soldOut ? 'Sold out' : 'Register now →'}
            </button>

            {!soldOut && (
              <p className="ed-register-note">
                Secure checkout · Refundable up to 7 days before event
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
