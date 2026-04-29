import { useState, useEffect } from 'react'
import { registrationsApi, eventsApi } from '../services/api'
import api from '../services/api'

// ── Icons ────────────────────────────────────────────────────────────────────

const IcoStar = ({ filled }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? '#ffffff' : 'none'} stroke="#ffffff" strokeWidth="1.5">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinejoin="round" />
  </svg>
)

const IcoChevron = ({ open }) => (
  <svg
    width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
  >
    <path d="M3 5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IcoCal = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="11" height="10" rx="1.2" />
    <line x1="0.5" y1="4.5" x2="11.5" y2="4.5" />
    <line x1="3.5" y1="0" x2="3.5" y2="3" strokeLinecap="round" />
    <line x1="8.5" y1="0" x2="8.5" y2="3" strokeLinecap="round" />
  </svg>
)

const IcoPin = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3Z" strokeLinejoin="round" />
    <circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

const IcoCheck = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 6.5l4 4 5-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IcoEmpty = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M4 8h36a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
    <line x1="14" y1="18" x2="30" y2="18" strokeLinecap="round" />
    <line x1="14" y1="24" x2="24" y2="24" strokeLinecap="round" />
  </svg>
)

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function getLocation(event) {
  if (!event) return '—'
  if (event.location_type === 'online') return 'Online'
  return event.physical_address || '—'
}

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly = false, size = 22 }) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="fb-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`fb-star-btn${readonly ? ' fb-star-btn--readonly' : ''}`}
          onClick={() => !readonly && onChange(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          disabled={readonly}
          style={{ '--star-size': `${size}px` }}
        >
          <IcoStar filled={n <= (hovered || value)} />
        </button>
      ))}
    </div>
  )
}

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({ review }) {
  const date = formatDate(review.created_at)
  return (
    <div className="fb-review-card">
      <div className="fb-review-head">
        <StarRating value={review.rating} readonly size={13} />
        <span className="fb-review-date">{date}</span>
      </div>
      {review.comment && <p className="fb-review-text">{review.comment}</p>}
      <span className="fb-review-author">Anonymous attendee</span>
    </div>
  )
}

// ── Event Review Item ─────────────────────────────────────────────────────────

function EventReviewItem({ event }) {
  const [open, setOpen]               = useState(false)
  const [loaded, setLoaded]           = useState(false)
  const [existingReview, setExistingReview] = useState(null)
  const [reviews, setReviews]         = useState([])
  const [loadingInner, setLoadingInner] = useState(false)

  // Form state
  const [rating, setRating]           = useState(0)
  const [comment, setComment]         = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted]     = useState(false)

  const handleToggle = async () => {
    setOpen(o => !o)

    // Load reviews only once on first open
    if (!loaded) {
      setLoadingInner(true)
      setLoaded(true)

      const [myRes, allRes] = await Promise.allSettled([
        api.get(`/api/events/${event.id}/reviews/me`),
        api.get(`/api/events/${event.id}/reviews`),
      ])

      if (myRes.status === 'fulfilled') {
        const r = myRes.value.data
        setExistingReview(r)
        setRating(r.rating)
        setComment(r.comment ?? '')
        setIsAnonymous(r.is_anonymous)
      }

      if (allRes.status === 'fulfilled') {
        setReviews(allRes.value.data ?? [])
      }

      setLoadingInner(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (rating === 0) { setSubmitError('Please select a star rating.'); return }
    setSubmitError('')
    setSubmitting(true)

    try {
      await api.post('/api/reviews', {
        event_id:     event.id,
        rating,
        comment:      comment.trim() || null,
        is_anonymous: isAnonymous,
      })
      setSubmitted(true)

      // Refresh all reviews
      const allRes = await api.get(`/api/events/${event.id}/reviews`)
      setReviews(allRes.value?.data ?? allRes.data ?? [])
    } catch (err) {
      const msg = err.response?.data?.detail
      setSubmitError(typeof msg === 'string' ? msg : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const otherReviews = existingReview
    ? reviews.filter(r => r.id !== existingReview.id)
    : reviews

  const location = getLocation(event)
  const date     = formatDate(event.start_datetime)
  const hasReview = !!existingReview

  return (
    <div className={`fb-event-item${open ? ' fb-event-item--open' : ''}`}>

      {/* ── header row (always visible) ── */}
      <button className="fb-event-header" onClick={handleToggle} type="button">
        <div className="fb-event-header-left">
          <div className="fb-event-thumb">
            <span>{event.location_type === 'online' ? 'ONL' : 'EVT'}</span>
          </div>
          <div className="fb-event-info">
            <p className="fb-event-title">{event.title}</p>
            <div className="fb-event-meta">
              <span className="fb-event-meta-item"><IcoCal /> {date}</span>
              <span className="fb-event-meta-item"><IcoPin /> {location}</span>
            </div>
          </div>
        </div>
        <div className="fb-event-header-right">
          {hasReview && (
            <span className="fb-reviewed-badge">
              <IcoCheck /> Reviewed
            </span>
          )}
          <IcoChevron open={open} />
        </div>
      </button>

      {/* ── expandable body ── */}
      {open && (
        <div className="fb-event-body">
          {loadingInner ? (
            <div className="fb-inner-loading">Loading…</div>
          ) : (
            <>
              {/* Form */}
              <div className="fb-form-wrap">
                {submitted ? (
                  <div className="fb-success">
                    <span className="fb-success-icon"><IcoCheck /></span>
                    <div>
                      <p className="fb-success-title">Review submitted</p>
                      <p className="fb-success-sub">Thanks for sharing your experience.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="fb-form">
                    <p className="fb-form-title">
                      {existingReview ? 'Edit your review' : 'Rate your experience'}
                    </p>

                    <StarRating value={rating} onChange={setRating} />

                    <textarea
                      className="fb-textarea"
                      rows={3}
                      placeholder="Share your thoughts about this event…"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      maxLength={1000}
                    />

                    <div className="fb-form-footer">
                      <label className="fb-anon-row">
                        <span className="fb-anon-label">Post anonymously</span>
                        <button
                          type="button"
                          className={`toggle-switch${isAnonymous ? ' on' : ''}`}
                          onClick={() => setIsAnonymous(v => !v)}
                        />
                      </label>

                      <div className="fb-form-actions">
                        {submitError && <p className="fb-error">{submitError}</p>}
                        <button
                          type="submit"
                          className="fb-submit-btn"
                          disabled={submitting || rating === 0}
                        >
                          {submitting
                            ? 'Submitting…'
                            : existingReview
                            ? 'Update review'
                            : 'Submit review'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Other reviews */}
              {otherReviews.length > 0 && (
                <div className="fb-other-reviews">
                  <p className="fb-reviews-title">
                    What others said · {otherReviews.length} review{otherReviews.length !== 1 ? 's' : ''}
                  </p>
                  <div className="fb-reviews-list">
                    {otherReviews.map(r => (
                      <ReviewCard key={r.id} review={r} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Feedback() {
  const [pastEvents, setPastEvents]   = useState([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const regsRes = await registrationsApi.getMine()
        const confirmed = (regsRes.data ?? []).filter(r => r.status === 'confirmed')

        if (confirmed.length === 0) {
          if (!cancelled) setLoading(false)
          return
        }

        const eventResults = await Promise.allSettled(
          confirmed.map(r => eventsApi.getById(r.event_id).then(res => res.data))
        )

        if (cancelled) return

        const now = new Date()
        const past = eventResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.value)
          .filter(e => e && new Date(e.end_datetime) < now)
          .filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
          .sort((a, b) => new Date(b.end_datetime) - new Date(a.end_datetime))

        setPastEvents(past)
      } catch {
        // empty state handles it
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="ed-state">Loading…</div>

  return (
    <div className="fb-page">
      <div className="fb-header">
        <div>
          <h1 className="fb-heading">Feedback</h1>
          <p className="fb-sub">Tell us how your events went. Reviews are anonymized.</p>
        </div>
      </div>

      {pastEvents.length === 0 ? (
        <div className="tickets-empty">
          <span className="tickets-empty-icon"><IcoEmpty /></span>
          <p className="tickets-empty-title">No events to review yet</p>
          <p className="tickets-empty-sub">
            You can leave a review after an event you attended has ended.
          </p>
        </div>
      ) : (
        <div className="fb-events-list">
          {pastEvents.map(event => (
            <EventReviewItem key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}