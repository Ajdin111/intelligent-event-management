import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { eventsApi, ticketTiersApi, reviewsApi, agendaApi } from '../services/api'
import NotFound from './NotFound'

// Per-event cover images — themed to each event's spirit
const COVERS = {
  1: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?auto=format&fit=crop&w=1600&q=80', // Vector Summit — AI neural network
  2: 'https://images.unsplash.com/photo-1593720219276-0b1eacd0aef4?auto=format&fit=crop&w=1600&q=80', // ReactNext — frontend code
  3: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1600&q=80', // Product Craft — product whiteboard
  4: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1600&q=80',    // EdgeCloud — cloud servers
  5: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80',    // Warehouse — data analytics
  6: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?auto=format&fit=crop&w=1600&q=80', // PlatformCon — DevOps pipeline
  7: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1600&q=80',    // ZeroTrust — cybersecurity
  8: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1600&q=80',    // Interface — UI/UX design
  9: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1600&q=80', // Model Eval — ML models
}
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=80'

// Static metadata not available in the event API response (category name, organizer name).
// Tiers are kept as fallback only for events where the API returns no real tiers.
const FAKE = {
  1: { category: 'AI & ML',  organizer: 'Northwind Labs',
       tiers: [{ name: 'Community', price: 0, total: 150, sold: 128 }, { name: 'Standard', price: 199, total: 300, sold: 210 }, { name: 'VIP', price: 599, total: 50, sold: 14 }] },
  2: { category: 'Frontend', organizer: 'Parallel',
       tiers: [{ name: 'Community', price: 0, total: 250, sold: 228 }, { name: 'Workshop', price: 79, total: 80, sold: 60 }] },
  3: { category: 'Product',  organizer: 'Orbit',
       tiers: [{ name: 'Community', price: 0, total: 400, sold: 340 }, { name: 'Pro', price: 149, total: 100, sold: 42 }] },
  4: { category: 'Cloud',    organizer: 'Helix Platform',
       tiers: [{ name: 'Standard', price: 249, total: 400, sold: 312 }, { name: 'VIP', price: 499, total: 60, sold: 28 }] },
  5: { category: 'Data',     organizer: 'Stratus Data',
       tiers: [{ name: 'Standard', price: 349, total: 500, sold: 290 }, { name: 'Workshop', price: 499, total: 80, sold: 55 }] },
  6: { category: 'DevOps',   organizer: 'Runbook',
       tiers: [{ name: 'Community', price: 0, total: 1000, sold: 844 }, { name: 'Pro', price: 249, total: 150, sold: 94 }] },
  7: { category: 'Security', organizer: 'Aegis Security',
       tiers: [{ name: 'Standard', price: 149, total: 2000, sold: 760 }, { name: 'VIP', price: 349, total: 200, sold: 88 }] },
  8: { category: 'Design',   organizer: 'Studio Kilo',
       tiers: [{ name: 'Standard', price: 399, total: 300, sold: 226 }, { name: 'VIP', price: 699, total: 50, sold: 32 }] },
  9: { category: 'AI & ML',  organizer: 'Northwind Labs',
       tiers: [{ name: 'Standard', price: 99, total: 800, sold: 280 }, { name: 'Pro', price: 199, total: 100, sold: 34 }] },
}

function fmtSessionTime(iso) {
  // Slice HH:MM directly from the ISO string — avoids cross-browser timezone parsing
  if (!iso || !iso.includes('T')) return '—'
  return iso.split('T')[1].slice(0, 5)
}

function fmtDuration(start, end) {
  // Parse HH:MM manually so timezone interpretation never affects the result
  if (!start || !end) return '—'
  const timePart = (iso) => iso.split('T')[1] ?? '00:00'
  const toMins   = (iso) => { const [h, m] = timePart(iso).split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10) }
  const mins = toMins(end) - toMins(start)
  if (mins <= 0) return '—'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function formatRelativeDate(iso) {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7)  return `${diffDays} days ago`
  const weeks = Math.floor(diffDays / 7)
  if (weeks === 1)   return '1 week ago'
  if (weeks < 5)     return `${weeks} weeks ago`
  const months = Math.floor(diffDays / 30)
  return months <= 1 ? '1 month ago' : `${months} months ago`
}

// ── icons ────────────────────────────────────────────────────────────────────

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

// ── component ─────────────────────────────────────────────────────────────────

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [realTiers, setRealTiers] = useState([])
  const [reviews, setReviews] = useState([])
  const [agendaTracks, setAgendaTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [realEventData, setRealEventData] = useState(null)
  const [selectedTier, setSelectedTier] = useState(0)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    const numId = Number(id)

    if (!id || isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
      setEvent(null)
      setLoading(false)
      return
    }

    Promise.all([
      eventsApi.getById(id),
      ticketTiersApi.listByEvent(id),
      reviewsApi.listByEvent(id).then(r => r.data).catch(() => []),
      agendaApi.listTracks(id).then(r => r.data).catch(() => []),
      agendaApi.listSessions(id).then(r => r.data).catch(() => []),
    ])
      .then(([evRes, tiersRes, realReviews, rawTracks, rawSessions]) => {
        const real = evRes.data
        setRealEventData(real)

        const fmtTime = dt =>
          (dt && dt.includes('T')) ? dt.split('T')[1].slice(0, 5) : null
        const t0 = fmtTime(real.start_datetime)
        const t1 = fmtTime(real.end_datetime)

        const fake = FAKE[numId] ?? null
        setEvent({
          title:       real.title || 'TeqEvent',
          category:    fake?.category   || 'Tech',
          organizer:   fake?.organizer  || 'TeqEvent',
          description: real.description || 'No description available.',
          location:    real.physical_address || (real.location_type === 'online' ? 'Remote' : 'TBD'),
          date:        real.start_datetime
            ? new Date(real.start_datetime).toLocaleDateString('en-US',
                { month: 'long', day: 'numeric', year: 'numeric' })
            : 'TBD',
          time: t0 && t1 ? `${t0} – ${t1}` : t0 || 'TBD',
          tiers: fake?.tiers || [],
        })

        setRealTiers(tiersRes.data)
        setReviews(Array.isArray(realReviews) ? realReviews : [])

        // Build agenda: group sessions under their track
        const sessionsByTrack = {}
        rawSessions.forEach(s => {
          if (!sessionsByTrack[s.track_id]) sessionsByTrack[s.track_id] = []
          sessionsByTrack[s.track_id].push(s)
        })
        const built = [...rawTracks]
          .sort((a, b) => a.order_index - b.order_index)
          .map(track => ({
            id:       track.id,
            name:     track.name,
            color:    track.color,
            sessions: (sessionsByTrack[track.id] || [])
              .sort((a, b) => a.order_index - b.order_index)
              .map(s => ({
                time:     fmtSessionTime(s.start_datetime),
                title:    s.title,
                speaker:  s.speaker_name || '—',
                room:     s.location     || '—',
                duration: fmtDuration(s.start_datetime, s.end_datetime),
              })),
          }))
        setAgendaTracks(built)
      })
      .catch(() => {
        setEvent(null)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="ed-state">Loading…</div>
  if (!event)  return <NotFound />

  const cover = COVERS[Number(id)] || DEFAULT_COVER

  // Prefer real tiers from API; only fall back to FAKE tiers for paid events without real tiers
  const isFreeEvent = realEventData?.is_free ?? false
  const displayTiers = realTiers.length > 0
    ? realTiers.map(t => ({
        id:        t.id,
        name:      t.name,
        price:     parseFloat(t.price),
        total:     t.quantity,
        sold:      t.quantity_sold,
        available: t.quantity_available,
        soldOut:   t.is_sold_out || !t.is_active,
      }))
    : isFreeEvent
      ? []
      : (event.tiers || []).map(t => ({
          id:        null,
          name:      t.name,
          price:     t.price,
          total:     t.total,
          sold:      t.sold,
          available: t.total - t.sold,
          soldOut:   t.sold >= t.total,
        }))

  // Free events with no ticketing tiers register directly without a tier selection
  const isFreeNoTier = isFreeEvent && displayTiers.length === 0
  const tier      = isFreeNoTier ? null : displayTiers[selectedTier]
  const soldOut   = isFreeNoTier ? false : (tier?.soldOut ?? true)
  const available = tier?.available ?? 0
  const subtotal  = isFreeNoTier
    ? 'Free'
    : tier
      ? (tier.price === 0 ? 'Free' : `$${(tier.price * quantity).toLocaleString()}`)
      : '—'
  const reviewCount = reviews.length
  const rating      = reviewCount > 0
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviewCount * 10) / 10
    : 0
  const breakdown   = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    pct: reviewCount > 0
      ? Math.round(reviews.filter(r => r.rating === stars).length / reviewCount * 100)
      : 0,
  }))
  const hasRating  = reviewCount > 0
  const hasSamples = reviews.some(r => r.comment)

  const handleRegister = () => {
    if (!isFreeNoTier && (!tier || soldOut)) return
    navigate(`/events/${id}/register`, {
      state: {
        eventId:       Number(id),
        eventTitle:    event.title,
        eventDate:     event.date,
        eventLocation: event.location,
        eventCategory: event.category,
        tier:          isFreeNoTier ? null : { id: tier.id, name: tier.name, price: tier.price },
        quantity:      isFreeNoTier ? 1 : quantity,
      },
    })
  }

  return (
    <div className="ed-wrap">

      {/* back */}
      <button className="ed-back" onClick={() => navigate('/events')}>
        <IcoBack /> Back to discover
      </button>

      {/* hero */}
      <div className="ed-hero-frame">
        <div className="ed-hero">
          <img src={cover} alt={event.title} className="ed-hero-img" />
          <div className="ed-hero-overlay" />
        </div>
      </div>

      {/* meta bar */}
      <div className="ed-meta-bar">
        <div className="ed-meta-left">
          <span className="ed-cat-pill">{event.category}</span>
          {hasRating && (
            <div className="ed-rating-row">
              <StarRow rating={rating} />
              <span className="ed-rating-val">{rating}</span>
              <span className="ed-rating-count">· {reviewCount} reviews</span>
            </div>
          )}
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
        <span className="ed-info-item"><IcoCal />   {event.date}</span>
        <span className="ed-info-item"><IcoClock /> {event.time}</span>
        <span className="ed-info-item"><IcoPin />   {event.location}</span>
        <span className="ed-info-item"><IcoGroup /> Hosted by {event.organizer}</span>
      </div>

      {/* two-column body */}
      <div className="ed-body">

        {/* ── left ── */}
        <div className="ed-main">

          <section className="ed-section">
            <h2 className="ed-section-h">About this event</h2>
            {event.description.split('\n\n').map((p, i) => (
              <p key={i} className="ed-desc">{p}</p>
            ))}
          </section>

          {agendaTracks.length > 0 && (
            <section className="ed-section">
              <h2 className="ed-section-h">Agenda</h2>
              <div className="ed-tracks">
                {agendaTracks.map(track => (
                  <div key={track.id} className="ed-track">
                    <div className="ed-track-head">
                      <span className="ed-track-bar" style={track.color ? { background: track.color } : undefined} />
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

          <section className="ed-section">
            <h2 className="ed-section-h">Reviews & ratings</h2>
            {hasRating ? (
              <>
                {/* aggregate summary — uses total reviewCount */}
                <div className="ed-review-summary">
                  <div className="ed-score-col">
                    <span className="ed-score-num">{rating}</span>
                    <StarRow rating={rating} size={14} />
                    <span className="ed-score-sub">{reviewCount} reviews</span>
                  </div>
                  <div className="ed-bars">
                    {breakdown.map(r => (
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

                {hasSamples && (
                  <div className="ed-review-list">
                    {reviews.filter(r => r.comment).map(r => (
                      <div key={r.id} className="ed-review-card">
                        <div className="ed-review-head">
                          <StarRow rating={r.rating} size={12} />
                          <span className="ed-review-date">{formatRelativeDate(r.created_at)}</span>
                        </div>
                        <p className="ed-review-text">{r.comment}</p>
                        <span className="ed-review-author">
                          {r.is_anonymous ? 'Anonymous attendee' : 'Verified attendee'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="ed-desc">No reviews yet. Be the first to attend and share your experience.</p>
            )}
          </section>
        </div>

        {/* ── right sidebar ── */}
        <aside className="ed-sidebar">
          <div className="ed-ticket-box">
            <p className="ed-ticket-label">{isFreeNoTier ? 'FREE EVENT' : 'CHOOSE A TIER'}</p>
            {isFreeNoTier ? (
              <div style={{ padding: '12px 0 4px', fontSize: 13.5, color: 'var(--text-sub)' }}>
                This is a free event. No ticket purchase required — just register to secure your spot.
              </div>
            ) : (
            <div className="ed-tiers">
              {displayTiers.length === 0 ? (
                <p className="ed-desc" style={{ fontSize: 13, padding: '8px 0' }}>No ticket tiers available yet.</p>
              ) : displayTiers.map((t, i) => {
                const fill = t.total > 0 ? Math.round((t.sold / t.total) * 100) : 0
                return (
                  <button
                    key={t.name}
                    disabled={t.soldOut}
                    onClick={() => { if (!t.soldOut) { setSelectedTier(i); setQuantity(1) } }}
                    className={[
                      'ed-tier',
                      selectedTier === i && !t.soldOut ? 'ed-tier--active' : '',
                      t.soldOut ? 'ed-tier--soldout' : '',
                    ].join(' ')}
                  >
                    <div className="ed-tier-row">
                      <span className="ed-tier-name">{t.name}</span>
                      <span className="ed-tier-price">
                        {t.soldOut ? 'Sold out' : t.price === 0 ? 'Free' : `$${t.price}`}
                      </span>
                    </div>
                    <span className="ed-tier-avail">
                      {t.soldOut ? 'No spots remaining' : `${t.available} of ${t.total} left`}
                    </span>
                    <div className="ed-tier-track">
                      <div className="ed-tier-fill" style={{ width: `${fill}%` }} />
                    </div>
                  </button>
                )
              })}
            </div>
            )}

            {!isFreeNoTier && !soldOut && displayTiers.length > 0 && (
              <>
                <div className="ed-qty-row">
                  <span className="ed-qty-label">Quantity</span>
                  <div className="ed-qty-ctrl">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                    <span>{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(available, q + 1))}>+</button>
                  </div>
                </div>
                <div className="ed-subtotal-row">
                  <span>Subtotal</span>
                  <strong className="ed-subtotal-val">{subtotal}</strong>
                </div>
              </>
            )}

            <button
              className="ed-register-btn"
              disabled={!isFreeNoTier && (soldOut || displayTiers.length === 0)}
              onClick={handleRegister}
            >
              {!isFreeNoTier && soldOut ? 'Sold out' : 'Register now →'}
            </button>

            {!isFreeNoTier && !soldOut && displayTiers.length > 0 && (
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
