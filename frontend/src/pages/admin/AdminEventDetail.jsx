import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { eventsApi, ticketTiersApi, reviewsApi, agendaApi, adminApi } from '../../services/api'
import NotFound from '../NotFound'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso) {
  if (!iso) return '—'
  const parts = iso.slice(0, 10).split('-')
  if (parts.length < 3) return '—'
  const [year, month, day] = parts
  return `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`
}

function fmtTime(iso) {
  if (!iso || !iso.includes('T')) return null
  return iso.split('T')[1].slice(0, 5)
}

function fmtDateTime(iso) {
  const date = fmtDate(iso)
  const time = fmtTime(iso)
  return time ? `${date} at ${time}` : date
}

function fmtDuration(start, end) {
  if (!start || !end) return '—'
  const toMins = (iso) => {
    const part = iso.includes('T') ? iso.split('T')[1] : iso
    const [h, m] = part.split(':')
    return parseInt(h, 10) * 60 + parseInt(m, 10)
  }
  const mins = toMins(end) - toMins(start)
  if (mins <= 0) return '—'
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}min` : `${h}h`
}

function normalizeError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return fallback
}

function formatRelativeDate(iso) {
  if (!iso) return ''
  const diffDays = Math.floor((Date.now() - new Date(iso.replace('T', ' ')).getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7)  return `${diffDays} days ago`
  const weeks = Math.floor(diffDays / 7)
  if (weeks < 5)     return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

const STATUS_PILL_MAP = {
  published: { cls: 'adm-event-status--published', label: 'Published' },
  draft:     { cls: 'adm-event-status--draft',     label: 'Draft' },
  cancelled: { cls: 'adm-event-status--cancelled', label: 'Cancelled' },
  closed:    { cls: 'adm-event-status--closed',    label: 'Closed' },
}

function StatusPill({ status }) {
  const cfg = STATUS_PILL_MAP[status] ?? { cls: '', label: status ?? '—' }
  return <span className={`adm-event-status ${cfg.cls}`}>{cfg.label}</span>
}

function StarRow({ rating, size = 13 }) {
  return (
    <span className="adm-evd-stars">
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

export default function AdminEventDetail() {
  const { eventId } = useParams()
  const navigate    = useNavigate()

  const [event, setEvent]           = useState(null)
  const [owner, setOwner]           = useState(null)
  const [tiers, setTiers]           = useState([])
  const [reviews, setReviews]       = useState([])
  const [agendaTracks, setAgendaTracks] = useState([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [error, setError]           = useState(false)
  const [notice, setNotice]         = useState('')
  const [busy, setBusy]             = useState(null)

  const numId    = Number(eventId)
  const invalidId = !eventId || !Number.isInteger(numId) || numId <= 0

  useEffect(() => {
    if (invalidId) { setNotFound(true); setLoading(false); return }

    Promise.all([
      eventsApi.getById(numId),
      ticketTiersApi.listByEvent(numId).catch(() => ({ data: [] })),
      reviewsApi.listByEvent(numId).then(r => r.data).catch(() => []),
      agendaApi.listTracks(numId).then(r => r.data).catch(() => []),
      agendaApi.listSessions(numId).then(r => r.data).catch(() => []),
    ])
      .then(([evRes, tiersRes, rawReviews, rawTracks, rawSessions]) => {
        const evData = evRes.data
        setEvent(evData)
        // Fetch owner info — owner_email is always null from the backend, so load separately
        adminApi.getUser(evData.owner_id).then(r => setOwner(r.data)).catch(() => {})
        setTiers(Array.isArray(tiersRes.data) ? tiersRes.data : [])
        setReviews(Array.isArray(rawReviews) ? rawReviews : [])

        const byTrack = {}
        rawSessions.forEach(s => {
          if (!byTrack[s.track_id]) byTrack[s.track_id] = []
          byTrack[s.track_id].push(s)
        })
        setAgendaTracks(
          [...rawTracks]
            .sort((a, b) => a.order_index - b.order_index)
            .map(t => ({
              ...t,
              sessions: (byTrack[t.id] ?? []).sort((a, b) => a.order_index - b.order_index),
            }))
        )
      })
      .catch(err => {
        if (err?.response?.status === 404) setNotFound(true)
        else setError(true)
      })
      .finally(() => setLoading(false))
  }, [numId, invalidId])

  const unpublish = async () => {
    setNotice('')
    setBusy('unpublish')
    try {
      const r = await adminApi.unpublishEvent(numId)
      setEvent(prev => ({ ...prev, ...r.data }))
      setNotice('Event unpublished successfully.')
    } catch (err) {
      setNotice(normalizeError(err, 'Failed to unpublish event.'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${event?.title}"? This cannot be undone.`)) return
    setBusy('delete')
    try {
      await adminApi.deleteEvent(numId)
      navigate('/admin/events', { replace: true })
    } catch (err) {
      setNotice(normalizeError(err, 'Failed to delete event.'))
      setBusy(null)
    }
  }

  if (loading)  return <div className="ed-state">Loading…</div>
  if (notFound) return <NotFound />
  if (error)    return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load event.</p>
    </div>
  )

  const reviewCount = reviews.length
  const rating = reviewCount > 0
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviewCount * 10) / 10
    : 0
  const breakdown = [5,4,3,2,1].map(n => ({
    n,
    pct: reviewCount > 0
      ? Math.round(reviews.filter(r => r.rating === n).length / reviewCount * 100)
      : 0,
  }))

  return (
    <div className="adm-wrap">

      {/* ── header ── */}
      <div className="adm-header">
        <div>
          <button className="adm-users-back" onClick={() => navigate('/admin/events')} type="button">
            Back to events
          </button>
          <div className="adm-evd-title-row">
            <h1 className="adm-title">{event.title}</h1>
            <StatusPill status={event.status} />
          </div>
          <p className="adm-sub">
            Event #{event.id}
            {owner
              ? ` · ${owner.first_name} ${owner.last_name} (${owner.email})`
              : ` · Owner #${event.owner_id}`}
          </p>
        </div>
        <div className="adm-header-actions">
          {event.status === 'published' && (
            <button
              className="adm-btn-secondary"
              onClick={unpublish}
              disabled={!!busy}
              type="button"
            >
              {busy === 'unpublish' ? '…' : 'Unpublish'}
            </button>
          )}
          <button
            className="adm-btn-secondary adm-btn-danger"
            onClick={remove}
            disabled={!!busy}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {notice && <p className="adm-users-notice">{notice}</p>}

      {/* ── two-column body ── */}
      <div className="adm-evd-body">

        {/* left: about, agenda, reviews */}
        <div className="adm-evd-main">

          <section className="adm-evd-section">
            <h2 className="adm-evd-section-h">About this event</h2>
            {(event.description || 'No description provided.').split('\n\n').map((p, i) => (
              <p key={i} className="adm-evd-p">{p}</p>
            ))}
          </section>

          {agendaTracks.length > 0 && (
            <section className="adm-evd-section">
              <h2 className="adm-evd-section-h">Agenda</h2>
              <div className="adm-evd-tracks">
                {agendaTracks.map(track => (
                  <div key={track.id} className="adm-evd-track">
                    <div className="adm-evd-track-head">
                      <span
                        className="adm-evd-track-bar"
                        style={track.color ? { background: track.color } : undefined}
                      />
                      <span className="adm-evd-track-name">{track.name}</span>
                      <span className="adm-evd-track-count">· {track.sessions.length} session{track.sessions.length !== 1 ? 's' : ''}</span>
                    </div>
                    {track.sessions.length === 0 ? (
                      <p className="adm-evd-p adm-evd-p--muted" style={{ marginLeft: 16 }}>No sessions added.</p>
                    ) : track.sessions.map(s => (
                      <div key={s.id} className="adm-evd-session">
                        <span className="adm-evd-session-time">
                          {fmtTime(s.start_datetime) ?? '—'}
                        </span>
                        <div className="adm-evd-session-info">
                          <span className="adm-evd-session-title">{s.title}</span>
                          <span className="adm-evd-session-meta">
                            {s.speaker_name || '—'} · {s.location || '—'}
                          </span>
                        </div>
                        <span className="adm-evd-session-dur">
                          {fmtDuration(s.start_datetime, s.end_datetime)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="adm-evd-section">
            <h2 className="adm-evd-section-h">Reviews</h2>
            {reviewCount === 0 ? (
              <p className="adm-evd-p adm-evd-p--muted">No reviews yet for this event.</p>
            ) : (
              <>
                <div className="adm-evd-review-summary">
                  <div className="adm-evd-score-col">
                    <span className="adm-evd-score-num">{rating}</span>
                    <StarRow rating={rating} size={14} />
                    <span className="adm-evd-score-sub">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="adm-evd-bars">
                    {breakdown.map(b => (
                      <div key={b.n} className="adm-evd-bar-row">
                        <span className="adm-evd-bar-label">{b.n}</span>
                        <div className="adm-evd-bar-track">
                          <div className="adm-evd-bar-fill" style={{ width: `${b.pct}%` }} />
                        </div>
                        <span className="adm-evd-bar-pct">{b.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                {reviews.filter(r => r.comment).slice(0, 5).map(r => (
                  <div key={r.id} className="adm-evd-review">
                    <div className="adm-evd-review-head">
                      <StarRow rating={r.rating} size={12} />
                      <span className="adm-evd-review-date">{formatRelativeDate(r.created_at)}</span>
                    </div>
                    <p className="adm-evd-review-text">{r.comment}</p>
                    <span className="adm-evd-review-author">
                      {r.is_anonymous ? 'Anonymous attendee' : 'Verified attendee'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>

        {/* right: admin info */}
        <aside className="adm-evd-side">

          <div className="adm-evd-info-card">
            <h3 className="adm-evd-info-title">Event details</h3>
            <dl className="adm-evd-facts">
              <div><dt>Status</dt><dd><StatusPill status={event.status} /></dd></div>
              {owner ? (
                <>
                  <div><dt>Organizer</dt><dd>{owner.first_name} {owner.last_name}</dd></div>
                  <div><dt>Email</dt><dd style={{ wordBreak: 'break-all' }}>{owner.email}</dd></div>
                </>
              ) : (
                <div><dt>Owner ID</dt><dd>#{event.owner_id}</dd></div>
              )}
              <div>
                <dt>Location type</dt>
                <dd className="adm-evd-capitalize">{event.location_type ?? '—'}</dd>
              </div>
              {event.physical_address && (
                <div><dt>Address</dt><dd>{event.physical_address}</dd></div>
              )}
              <div><dt>Starts</dt><dd>{fmtDateTime(event.start_datetime)}</dd></div>
              <div><dt>Ends</dt><dd>{fmtDateTime(event.end_datetime)}</dd></div>
              <div>
                <dt>Capacity</dt>
                <dd>{event.capacity != null ? event.capacity.toLocaleString() : 'Unlimited'}</dd>
              </div>
              <div><dt>Pricing</dt><dd>{event.is_free ? 'Free' : 'Paid'}</dd></div>
              {event.registration_type && (
                <div>
                  <dt>Registration</dt>
                  <dd className="adm-evd-capitalize">{event.registration_type.replace(/_/g, ' ')}</dd>
                </div>
              )}
              <div><dt>Created</dt><dd>{fmtDate(event.created_at)}</dd></div>
            </dl>
          </div>

          {tiers.length > 0 && (
            <div className="adm-evd-info-card">
              <h3 className="adm-evd-info-title">Ticket tiers</h3>
              <ul className="adm-evd-tiers">
                {tiers.map(t => {
                  const sold  = t.quantity_sold ?? 0
                  const total = t.quantity ?? 0
                  const pct   = total > 0 ? Math.round((sold / total) * 100) : 0
                  const price = parseFloat(t.price)
                  return (
                    <li key={t.id} className="adm-evd-tier">
                      <div className="adm-evd-tier-row">
                        <span className="adm-evd-tier-name">{t.name}</span>
                        <span className="adm-evd-tier-price">
                          {price === 0 ? 'Free' : `$${price}`}
                        </span>
                      </div>
                      <div className="adm-evd-tier-sub">{sold} sold of {total}</div>
                      <div className="adm-evd-tier-track">
                        <div className="adm-evd-tier-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {tiers.length === 0 && !event.is_free && (
            <div className="adm-evd-info-card">
              <h3 className="adm-evd-info-title">Ticket tiers</h3>
              <p className="adm-evd-p adm-evd-p--muted">No ticket tiers configured.</p>
            </div>
          )}

        </aside>
      </div>
    </div>
  )
}
