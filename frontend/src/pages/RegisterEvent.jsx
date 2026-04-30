import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { eventsApi, ticketTiersApi, registrationsApi, promoCodesApi } from '../services/api'

// ── icons ──────────────────────────────────────────────────────────────────

const IcoBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoCheck = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="10" cy="10" r="9" />
    <path d="M6 10l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoClock = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="10" cy="10" r="9" />
    <path d="M10 5v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoList = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="4" y1="6"  x2="16" y2="6"  strokeLinecap="round" />
    <line x1="4" y1="10" x2="16" y2="10" strokeLinecap="round" />
    <line x1="4" y1="14" x2="12" y2="14" strokeLinecap="round" />
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
const IcoPin = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6.5 1a3.5 3.5 0 0 1 3.5 3.5c0 2.5-3.5 7.5-3.5 7.5S3 7 3 4.5A3.5 3.5 0 0 1 6.5 1Z" strokeLinejoin="round" />
    <circle cx="6.5" cy="4.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

// ── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── component ──────────────────────────────────────────────────────────────

export default function RegisterEvent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()

  // Pre-filled from EventDetail navigation state
  const [eventInfo, setEventInfo] = useState(state?.eventTitle ? {
    title:    state.eventTitle,
    date:     state.eventDate,
    location: state.eventLocation,
    category: state.eventCategory,
  } : null)

  const [tiers, setTiers]         = useState([])
  const [selectedTierId, setSelectedTierId] = useState(state?.tier?.id ?? null)
  const [quantity, setQuantity]   = useState(state?.quantity ?? 1)
  const [promo, setPromo]         = useState('')
  const [promoApplied, setPromoApplied] = useState('')
  const [promoResult, setPromoResult]   = useState(null) // { discount_type, discount_value, final_price }
  const [promoError, setPromoError]     = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState(null) // { type: 'confirmed'|'pending'|'waitlisted', data }
  const [error, setError]           = useState('')
  const [pageLoading, setPageLoading] = useState(true)
  const [notFound, setNotFound]     = useState(false)

  // If navigated directly (no state), fetch event + tiers
  useEffect(() => {
    const numId = Number(id)
    if (!id || isNaN(numId) || numId <= 0) {
      setNotFound(true)
      setPageLoading(false)
      return
    }

    if (!eventInfo || tiers.length === 0) {
      Promise.all([
        eventsApi.getById(id),
        ticketTiersApi.listByEvent(id),
      ])
        .then(([evRes, tiersRes]) => {
          const real = evRes.data
          if (!eventInfo) {
            setEventInfo({
              title:    real.title,
              date:     formatDate(real.start_datetime),
              location: real.physical_address || (real.location_type === 'online' ? 'Remote' : 'TBD'),
              category: '',
            })
          }
          const activeTiers = tiersRes.data.filter(t => t.is_active && !t.is_sold_out)
          setTiers(tiersRes.data)
          if (!selectedTierId && activeTiers.length > 0) {
            setSelectedTierId(activeTiers[0].id)
          }
        })
        .catch((err) => {
          if (err?.response?.status === 404) {
            setNotFound(true)
          } else {
            navigate('/events', { replace: true })
          }
        })
        .finally(() => setPageLoading(false))
    } else {
      setPageLoading(false)
    }
  }, [id])

  const selectedTier = tiers.find(t => t.id === selectedTierId) ?? null

  const available       = selectedTier?.quantity_available ?? 0
  const price           = selectedTier ? parseFloat(selectedTier.price) : 0
  const isFree          = price === 0
  const originalTotal   = price * quantity
  const discountedPer   = promoResult ? parseFloat(promoResult.final_price) : null
  const finalTotal      = discountedPer !== null ? discountedPer * quantity : originalTotal
  const discountAmount  = discountedPer !== null ? originalTotal - finalTotal : 0
  const subtotal        = isFree ? 'Free' : `$${finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleApplyPromo = async () => {
    if (!promo.trim()) return
    if (!selectedTierId) { setPromoError('Please select a ticket tier first.'); return }
    try {
      const res = await promoCodesApi.validate(id, promo.trim(), selectedTierId)
      if (res.data.is_valid) {
        setPromoApplied(promo.trim())
        setPromoResult(res.data)
        setPromoError('')
      } else {
        setPromoError(res.data.message || 'Promo code is invalid or expired.')
        setPromoApplied('')
        setPromoResult(null)
      }
    } catch {
      setPromoError('Promo code is invalid or expired.')
      setPromoApplied('')
      setPromoResult(null)
    }
  }

  const handleSubmit = async () => {
    if (!selectedTierId) { setError('Please select a ticket tier.'); return }
    if (quantity < 1)    { setError('Quantity must be at least 1.');  return }
    setError('')
    setSubmitting(true)
    try {
      const res = await registrationsApi.create({
        event_id:       Number(id),
        ticket_tier_id: selectedTierId,
        quantity,
        ...(promoApplied ? { promo_code: promoApplied } : {}),
      })
      const data = res.data
      // 200 = waitlisted, 201 = registered
      if (data.position !== undefined) {
        setResult({ type: 'waitlisted', data })
      } else if (data.status === 'pending') {
        setResult({ type: 'pending', data })
      } else {
        setResult({ type: 'confirmed', data })
      }
    } catch (err) {
      const msg = err.response?.data?.detail
      setError(typeof msg === 'string' ? msg : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── success states ──────────────────────────────────────────────────────

  if (result) {
    const isWaitlist  = result.type === 'waitlisted'
    const isPending   = result.type === 'pending'
    const isConfirmed = result.type === 'confirmed'

    return (
      <div className="reg-wrap">
        <div className="reg-success-card">
          <div className={`reg-success-icon ${isConfirmed ? 'reg-success-icon--green' : 'reg-success-icon--amber'}`}>
            {isWaitlist ? <IcoList /> : isConfirmed ? <IcoCheck /> : <IcoClock />}
          </div>

          <h1 className="reg-success-title">
            {isWaitlist  ? "You're on the waitlist"   :
             isPending   ? 'Registration submitted'   :
                           'Registration confirmed!'}
          </h1>

          <p className="reg-success-sub">
            {isWaitlist
              ? `Position #${result.data.position} — we'll notify you if a spot opens up.`
              : isPending
              ? `Registration #${result.data.id} is pending organizer approval. We'll email you once approved.`
              : `Registration #${result.data.id} is confirmed. Check your email for details.`}
          </p>

          {eventInfo && (
            <div className="reg-success-event">
              <span className="reg-success-event-name">{eventInfo.title}</span>
              <span className="reg-success-event-meta">
                {selectedTier?.name} · {isFree ? 'Free' : `$${(price * quantity).toFixed(2)}`} · {quantity} ticket{quantity > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="reg-success-actions">
            <button className="reg-btn-primary" onClick={() => navigate('/registrations')}>
              View my registrations
            </button>
            <button className="reg-btn-secondary" onClick={() => navigate('/events')}>
              Back to discover
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (pageLoading) return <div className="ed-state">Loading…</div>

  if (notFound) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">404</p>
      <p className="ed-state-msg">Event not found</p>
      <button className="reg-btn-secondary" style={{ marginTop: 20, maxWidth: 200 }} onClick={() => navigate('/events')}>
        Back to events
      </button>
    </div>
  )

  // ── main form ───────────────────────────────────────────────────────────

  return (
    <div className="reg-wrap">
      <button className="ed-back" onClick={() => navigate(`/events/${id}`)}>
        <IcoBack /> Back to event
      </button>

      <div className="reg-layout">
        {/* ── left: event info + tier selection ── */}
        <div className="reg-main">
          {/* event summary */}
          {eventInfo && (
            <div className="reg-event-card">
              {eventInfo.category && (
                <span className="ed-cat-pill" style={{ marginBottom: 10, display: 'inline-block' }}>
                  {eventInfo.category}
                </span>
              )}
              <h2 className="reg-event-title">{eventInfo.title}</h2>
              <div className="reg-event-meta">
                {eventInfo.date     && <span className="ed-info-item"><IcoCal /> {eventInfo.date}</span>}
                {eventInfo.location && <span className="ed-info-item"><IcoPin /> {eventInfo.location}</span>}
              </div>
            </div>
          )}

          {/* tier selection */}
          <div className="reg-section">
            <h3 className="reg-section-h">Select a ticket tier</h3>
            {tiers.length === 0 ? (
              <p className="ed-desc">No ticket tiers available for this event.</p>
            ) : (
              <div className="reg-tiers">
                {tiers.map(t => {
                  const out      = t.is_sold_out || !t.is_active
                  const tierPrice = parseFloat(t.price)
                  const isSelected = t.id === selectedTierId
                  return (
                    <button
                      key={t.id}
                      disabled={out}
                      onClick={() => { if (!out) { setSelectedTierId(t.id); setQuantity(1); setPromoApplied(''); setPromoResult(null); setPromoError('') } }}
                      className={[
                        'reg-tier-btn',
                        isSelected && !out ? 'reg-tier-btn--active' : '',
                        out ? 'reg-tier-btn--soldout' : '',
                      ].join(' ')}
                    >
                      <div className="reg-tier-row">
                        <div className="reg-tier-left">
                          <span className="reg-tier-name">{t.name}</span>
                          {t.description && (
                            <span className="reg-tier-desc">{t.description}</span>
                          )}
                          <span className="reg-tier-avail">
                            {out ? 'Sold out'
                                 : `${t.quantity_available} of ${t.quantity} left`}
                          </span>
                        </div>
                        <span className="reg-tier-price">
                          {out ? '—' : tierPrice === 0 ? 'Free' : `$${tierPrice}`}
                        </span>
                      </div>
                      <div className="ed-tier-track" style={{ marginTop: 8 }}>
                        <div className="ed-tier-fill"
                          style={{ width: `${t.quantity > 0 ? Math.round((t.quantity_sold / t.quantity) * 100) : 0}%` }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* promo code */}
          <div className="reg-section">
            <h3 className="reg-section-h">Promo code <span className="reg-optional">(optional)</span></h3>
            <div className="reg-promo-row">
              <input
                type="text"
                className="reg-promo-input"
                placeholder="Enter promo code"
                value={promo}
                onChange={e => { setPromo(e.target.value); setPromoError(''); setPromoApplied(''); setPromoResult(null) }}
              />
              <button
                className="reg-promo-btn"
                onClick={handleApplyPromo}
                disabled={!promo.trim()}
              >
                Apply
              </button>
            </div>
            {promoApplied && <p className="reg-promo-ok">✓ Promo code applied</p>}
            {promoError   && <p className="reg-promo-err">{promoError}</p>}
          </div>
        </div>

        {/* ── right: order summary + confirm ── */}
        <aside className="reg-sidebar">
          <div className="reg-summary-box">
            <p className="ed-ticket-label">ORDER SUMMARY</p>

            {selectedTier ? (
              <>
                <div className="reg-summary-line">
                  <span>{selectedTier.name}</span>
                  <span>{isFree ? 'Free' : `$${price.toFixed(2)}`}</span>
                </div>

                <div className="reg-qty-row">
                  <span className="ed-qty-label">Quantity</span>
                  <div className="ed-qty-ctrl">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                    <span>{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(available, q + 1))}>+</button>
                  </div>
                </div>

                {!isFree && (
                  <div className="reg-summary-line" style={{ color: 'var(--text-secondary)' }}>
                    <span>Subtotal</span>
                    <span>${originalTotal.toFixed(2)}</span>
                  </div>
                )}

                {promoResult && discountAmount > 0 && (
                  <div className="reg-summary-line" style={{ color: '#16a34a' }}>
                    <span>
                      Discount ({promoResult.discount_type === 'percentage'
                        ? `${parseFloat(promoResult.discount_value)}% off`
                        : `$${parseFloat(promoResult.discount_value).toFixed(2)} off`})
                    </span>
                    <span>−${discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="reg-divider" />

                <div className="reg-total-row">
                  <span>Total</span>
                  <strong className="reg-total-val">{subtotal}</strong>
                </div>
              </>
            ) : (
              <p className="reg-summary-empty">Select a tier to see your total</p>
            )}

            {error && <p className="reg-error">{error}</p>}

            <button
              className="ed-register-btn"
              disabled={submitting || !selectedTierId || tiers.length === 0}
              onClick={handleSubmit}
            >
              {submitting ? 'Processing…' : isFree ? 'Confirm registration →' : `Pay ${subtotal} →`}
            </button>

            <p className="ed-register-note">
              {isFree
                ? 'Free registration · Cancel any time before the event'
                : 'Secure checkout · Refundable up to 7 days before event'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
