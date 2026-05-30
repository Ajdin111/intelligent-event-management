import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventsApi, organizerApi, categoriesApi, mlApi, collaboratorApi, inviteApi, API_BASE_URL } from '../../services/api'
import api from '../../services/api'

// ── Icons ────────────────────────────────────────────────────────────────────

const IcoChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5l3.5 3.5L10 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoEdit = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2l2 2-7 7H2v-2L9 2Z" strokeLinejoin="round" />
  </svg>
)
const IcoEye = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 6.5C1 6.5 3 2.5 6.5 2.5S12 6.5 12 6.5 10 10.5 6.5 10.5 1 6.5 1 6.5Z" strokeLinejoin="round" />
    <circle cx="6.5" cy="6.5" r="1.8" />
  </svg>
)
const IcoCheck = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 6.5l3.5 3.5 5.5-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoX = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="3" y1="3" x2="10" y2="10" strokeLinecap="round" />
    <line x1="10" y1="3" x2="3" y2="10" strokeLinecap="round" />
  </svg>
)
const IcoSend = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M11.5 1L1 6l4 2 2 4.5L11.5 1Z" strokeLinejoin="round" />
  </svg>
)
const IcoUsers = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="4" r="2.2" />
    <path d="M1 11.5c0-2.2 1.8-4 4-4s4 1.8 4 4" strokeLinecap="round" />
    <circle cx="10" cy="4.5" r="1.7" />
    <path d="M11.8 11.5c0-1.7-1-3-2.5-3.5" strokeLinecap="round" />
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
const IcoBack = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="6.5" y1="1.5" x2="6.5" y2="11.5" strokeLinecap="round" />
    <line x1="1.5" y1="6.5" x2="11.5" y2="6.5" strokeLinecap="round" />
  </svg>
)
const IcoPublish = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6.5 1v7M4 5.5L6.5 2 9 5.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 10.5v1a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-1" strokeLinecap="round" />
  </svg>
)
const IcoCancel = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6.5" cy="6.5" r="5.5" />
    <line x1="4" y1="4" x2="9" y2="9" strokeLinecap="round" />
  </svg>
)
const IcoEmpty = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="4" y="8" width="32" height="26" rx="3" />
    <line x1="4" y1="15" x2="36" y2="15" />
    <line x1="12" y1="4" x2="12" y2="12" strokeLinecap="round" />
    <line x1="28" y1="4" x2="28" y2="12" strokeLinecap="round" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function getLocation(event) {
  if (!event) return '—'
  if (event.location_type === 'online') return 'Online'
  if (event.location_type === 'hybrid') return `${event.physical_address || 'Hybrid'} + Online`
  return event.physical_address || '—'
}

function toNaiveDatetime(date, time) {
  if (!date || !time) return null
  return `${date}T${time}:00`
}

function toDateInputValue(iso) {
  if (!iso) return ''
  return new Date(iso).toISOString().split('T')[0]
}

function toTimeInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const STATUS_DOT = {
  confirmed: 'me-dot--green',
  pending:   'me-dot--amber',
  cancelled: 'me-dot--red',
  rejected:  'me-dot--red',
  waiting:   'me-dot--muted',
}

// ── Event List Item ───────────────────────────────────────────────────────────

function EventListItem({ event, selected, onClick }) {
  const statusColor = {
    published: '#4ade80',
    draft:     'rgba(255,255,255,0.35)',
    cancelled: '#f87171',
    closed:    'rgba(255,255,255,0.35)',
  }[event.status] ?? 'rgba(255,255,255,0.35)'

  return (
    <button
      className={`me-event-list-item${selected ? ' me-event-list-item--active' : ''}`}
      onClick={onClick}
    >
      <div className="me-event-list-item-left">
        <div className="me-event-list-thumb">
          {event.cover_image
            ? <img src={`${API_BASE_URL}${event.cover_image}`} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
            : <span>{(event.title || 'E').slice(0, 3).toUpperCase()}</span>
          }
        </div>
        <div className="me-event-list-info">
          <p className="me-event-list-title">{event.title}</p>
          <div className="me-event-list-meta">
            <span style={{ color: statusColor, fontSize: 11, fontWeight: 500 }}>● {event.status}</span>
            {event.start_datetime && (
              <span className="me-event-list-date"><IcoCal /> {formatDate(event.start_datetime)}</span>
            )}
          </div>
        </div>
      </div>
      <IcoChevronRight />
    </button>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ event, registrations, onActionDone }) {
  const [publishing, setPublishing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [flash, setFlash] = useState(null)
  const [demandForecast, setDemandForecast] = useState(null)
  const [sentiment, setSentiment] = useState(null)

  useEffect(() => {
    setDemandForecast(null)
    setSentiment(null)
    mlApi.demand(event.id).then(r => setDemandForecast(r.data)).catch(() => {})
    mlApi.sentiment(event.id).then(r => setSentiment(r.data)).catch(() => {})
  }, [event.id])

  const confirmed  = registrations.filter(r => r.status === 'confirmed').length
  const pending    = registrations.filter(r => r.status === 'pending').length
  const cancelled  = registrations.filter(r => r.status === 'cancelled' || r.status === 'rejected').length
  const revenue    = registrations
    .filter(r => r.status === 'confirmed')
    .reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
  const fillRate   = event.capacity ? Math.round(confirmed / event.capacity * 100) : null

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type })
    setTimeout(() => setFlash(null), 4000)
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      await eventsApi.publish(event.id)
      showFlash('Event published successfully.')
      onActionDone()
    } catch (err) {
      showFlash(err.response?.data?.detail || 'Could not publish.', 'error')
    } finally { setPublishing(false) }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this event? This cannot be undone.')) return
    setCancelling(true)
    try {
      await api.patch(`/api/events/${event.id}/cancel`)
      showFlash('Event cancelled.')
      onActionDone()
    } catch (err) {
      showFlash(err.response?.data?.detail || 'Could not cancel.', 'error')
    } finally { setCancelling(false) }
  }

  return (
    <div className="me-tab-content">
      {flash && (
        <div className={`me-flash me-flash--${flash.type}`}>{flash.msg}</div>
      )}

      {/* stat row */}
      <div className="me-stat-grid">
        <div className="me-stat-card">
          <span className="me-stat-label">REGISTERED</span>
          <span className="me-stat-value">{registrations.length}</span>
          <span className="me-stat-sub">{confirmed} confirmed · {pending} pending</span>
        </div>
        <div className="me-stat-card">
          <span className="me-stat-label">REVENUE</span>
          <span className="me-stat-value">
            {revenue === 0 ? '$0' : `$${revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
          <span className="me-stat-sub">From confirmed registrations</span>
        </div>
        <div className="me-stat-card">
          <span className="me-stat-label">FILL RATE</span>
          <span className="me-stat-value">{fillRate !== null ? `${fillRate}%` : '—'}</span>
          <span className="me-stat-sub">{event.capacity ? `Capacity: ${event.capacity}` : 'Unlimited capacity'}</span>
        </div>
        <div className="me-stat-card">
          <span className="me-stat-label">CANCELLED</span>
          <span className="me-stat-value">{cancelled}</span>
          <span className="me-stat-sub">Cancelled or rejected</span>
        </div>
      </div>

      {/* AI insights */}
      {(demandForecast || sentiment) && (
        <div className="me-details-card">
          <div className="me-details-head">
            <h3 className="me-details-title">
              AI insights
              <span className="oa-ai-badge" style={{ marginLeft: 8 }}>AI</span>
            </h3>
          </div>
          <div className="me-details-grid">
            {demandForecast && (
              <>
                <div className="me-detail-row">
                  <span className="me-detail-label">Predicted demand</span>
                  <span className="me-detail-val">{Math.round(demandForecast.predicted_demand)} registrations</span>
                </div>
                <div className="me-detail-row">
                  <span className="me-detail-label">Confidence</span>
                  <span className="me-detail-val">{Number(demandForecast.confidence_score ?? 0).toFixed(1)}%</span>
                </div>
                {demandForecast.price_action && demandForecast.price_action !== 'none' && (
                  <div className="me-detail-row">
                    <span className="me-detail-label">Price recommendation</span>
                    <span className="me-detail-val" style={{ textTransform: 'capitalize' }}>
                      {demandForecast.price_action.replace('_', ' ')}
                      {demandForecast.price_suggestion != null ? ` → $${demandForecast.price_suggestion}` : ''}
                    </span>
                  </div>
                )}
                {demandForecast.predicted_sellout_date && (
                  <div className="me-detail-row">
                    <span className="me-detail-label">Predicted sellout</span>
                    <span className="me-detail-val">{formatDate(demandForecast.predicted_sellout_date)}</span>
                  </div>
                )}
              </>
            )}
            {sentiment && sentiment.total_reviews > 0 && (
              <div className="me-detail-row me-detail-row--full">
                <span className="me-detail-label">Review sentiment</span>
                <span className="me-detail-val" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#4ade80' }}>▲ {Math.round(sentiment.positive_pct * 100)}% positive</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>● {Math.round(sentiment.neutral_pct * 100)}% neutral</span>
                  <span style={{ color: '#f87171' }}>▼ {Math.round(sentiment.negative_pct * 100)}% negative</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>({sentiment.total_reviews} reviews)</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* event details */}
      <div className="me-details-card">
        <div className="me-details-head">
          <h3 className="me-details-title">Event details</h3>
        </div>
        <div className="me-details-grid">
          <div className="me-detail-row">
            <span className="me-detail-label">Title</span>
            <span className="me-detail-val">{event.title}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">Status</span>
            <span className={`me-status-pill me-status-pill--${event.status}`}>{event.status}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">Location</span>
            <span className="me-detail-val">{getLocation(event)}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">Start</span>
            <span className="me-detail-val">{formatDateTime(event.start_datetime)}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">End</span>
            <span className="me-detail-val">{formatDateTime(event.end_datetime)}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">Registration type</span>
            <span className="me-detail-val" style={{ textTransform: 'capitalize' }}>{event.registration_type?.replace('_', ' ')}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">Ticketing</span>
            <span className="me-detail-val">{event.has_ticketing ? (event.is_free ? 'Free' : 'Paid') : 'No ticketing'}</span>
          </div>
          <div className="me-detail-row">
            <span className="me-detail-label">Feedback visibility</span>
            <span className="me-detail-val" style={{ textTransform: 'capitalize' }}>{event.feedback_visibility?.replace('_', ' ')}</span>
          </div>
          {event.description && (
            <div className="me-detail-row me-detail-row--full">
              <span className="me-detail-label">Description</span>
              <span className="me-detail-val me-detail-desc">{event.description}</span>
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="me-actions-row">
        {event.status === 'draft' && (
          <button className="me-action-btn me-action-btn--primary" onClick={handlePublish} disabled={publishing}>
            <IcoPublish /> {publishing ? 'Publishing…' : 'Publish event'}
          </button>
        )}
        {(event.status === 'draft' || event.status === 'published') && (
          <button className="me-action-btn me-action-btn--danger" onClick={handleCancel} disabled={cancelling}>
            <IcoCancel /> {cancelling ? 'Cancelling…' : 'Cancel event'}
          </button>
        )}
        <a
          href={`/events/${event.id}`}
          className="me-action-btn me-action-btn--ghost"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IcoEye /> View public page
        </a>
      </div>
    </div>
  )
}

// ── Edit Tab ──────────────────────────────────────────────────────────────────

function EditTab({ event, categories, onSaved }) {
  const [form, setForm] = useState({
    title:                event.title || '',
    description:          event.description || '',
    location_type:        event.location_type || 'physical',
    physical_address:     event.physical_address || '',
    online_link:          event.online_link || '',
    date:                 toDateInputValue(event.start_datetime),
    start_time:           toTimeInputValue(event.start_datetime),
    end_date:             toDateInputValue(event.end_datetime),
    end_time:             toTimeInputValue(event.end_datetime),
    capacity:             event.capacity ? String(event.capacity) : '',
    registration_type:    event.registration_type || 'automatic',
    requires_registration: event.requires_registration ?? true,
    feedback_visibility:  event.feedback_visibility || 'organizer_only',
    category_ids:         event.category_ids || [],
  })
  const [saving, setSaving]     = useState(false)
  const [flash, setFlash]       = useState(null)

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }))

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type })
    setTimeout(() => setFlash(null), 4000)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { showFlash('Title is required.', 'error'); return }
    if (form.category_ids.length === 0) { showFlash('Category is required.', 'error'); return }
    if (!form.date || !form.start_time) { showFlash('Start date and time are required.', 'error'); return }
    if (!form.end_date || !form.end_time) { showFlash('End date and time are required.', 'error'); return }

    const startDt = toNaiveDatetime(form.date, form.start_time)
    const endDt   = toNaiveDatetime(form.end_date, form.end_time)
    if (new Date(endDt) <= new Date(startDt)) { showFlash('End must be after start.', 'error'); return }

    setSaving(true)
    try {
      const payload = {
        title:                form.title.trim(),
        description:          form.description.trim(),
        location_type:        form.location_type,
        physical_address:     form.physical_address.trim() || null,
        online_link:          form.online_link.trim() || null,
        start_datetime:       startDt,
        end_datetime:         endDt,
        capacity:             form.capacity ? parseInt(form.capacity, 10) : null,
        registration_type:    form.registration_type,
        requires_registration: form.requires_registration,
        feedback_visibility:  form.feedback_visibility,
        category_ids:         form.category_ids.length > 0 ? form.category_ids : null,
      }
      await api.patch(`/api/events/${event.id}`, payload)
      showFlash('Changes saved successfully.')
      onSaved()
    } catch (err) {
      const detail = err.response?.data?.detail
      showFlash(typeof detail === 'string' ? detail : 'Could not save changes.', 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="me-tab-content">
      {flash && <div className={`me-flash me-flash--${flash.type}`}>{flash.msg}</div>}

      <div className="me-edit-form">
        <div className="me-form-group">
          <label className="me-form-label">Event title</label>
          <input className="me-form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Event title" />
        </div>

        <div className="me-form-group">
          <label className="me-form-label">Description</label>
          <textarea className="me-form-textarea" rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short overview attendees will see" />
        </div>

        {categories.length > 0 && (
          <div className="me-form-group">
            <label className="me-form-label">Category</label>
            <select
              className="me-form-input me-form-select"
              value={form.category_ids[0] || ''}
              onChange={e => set('category_ids', e.target.value ? [parseInt(e.target.value)] : [])}
            >
              <option value="">Select category…</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="me-form-row">
          <div className="me-form-group">
            <label className="me-form-label">Location type</label>
            <div className="me-type-toggle">
              {['physical', 'online', 'hybrid'].map(t => (
                <button key={t} className={`me-type-btn${form.location_type === t ? ' active' : ''}`} onClick={() => set('location_type', t)} style={{ textTransform: 'capitalize' }}>{t}</button>
              ))}
            </div>
          </div>
          <div className="me-form-group">
            <label className="me-form-label">Capacity <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input className="me-form-input" type="number" min="1" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="Unlimited" />
          </div>
        </div>

        {(form.location_type === 'physical' || form.location_type === 'hybrid') && (
          <div className="me-form-group">
            <label className="me-form-label">Physical address</label>
            <input className="me-form-input" value={form.physical_address} onChange={e => set('physical_address', e.target.value)} placeholder="e.g. 123 Main St, San Francisco" />
          </div>
        )}

        {(form.location_type === 'online' || form.location_type === 'hybrid') && (
          <div className="me-form-group">
            <label className="me-form-label">Online link</label>
            <input className="me-form-input" value={form.online_link} onChange={e => set('online_link', e.target.value)} placeholder="https://meet.example.com/…" />
          </div>
        )}

        <div className="me-form-row">
          <div className="me-form-group">
            <label className="me-form-label">Start date</label>
            <input className="me-form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="me-form-group">
            <label className="me-form-label">Start time</label>
            <input className="me-form-input" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          </div>
        </div>

        <div className="me-form-row">
          <div className="me-form-group">
            <label className="me-form-label">End date</label>
            <input className="me-form-input" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
          <div className="me-form-group">
            <label className="me-form-label">End time</label>
            <input className="me-form-input" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
        </div>

        <div className="me-form-group">
          <label className="me-form-label">Registration type</label>
          <div className="me-type-toggle">
            {[['automatic', 'Automatic'], ['manual', 'Manual approval'], ['invite_only', 'Invite only']].map(([v, l]) => (
              <button key={v} className={`me-type-btn${form.registration_type === v ? ' active' : ''}`} onClick={() => set('registration_type', v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="me-form-group">
          <label className="me-form-label">Feedback visibility</label>
          <div className="me-type-toggle">
            {[['public', 'Public'], ['organizer_only', 'Organizer only']].map(([v, l]) => (
              <button key={v} className={`me-type-btn${form.feedback_visibility === v ? ' active' : ''}`} onClick={() => set('feedback_visibility', v)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="me-toggle-row">
          <div>
            <p className="me-form-label" style={{ marginBottom: 0 }}>Requires registration</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Attendees must register to attend</p>
          </div>
          <button className={`toggle-switch${form.requires_registration ? ' on' : ''}`} onClick={() => set('requires_registration', !form.requires_registration)} />
        </div>

        <div className="me-edit-actions">
          <button className="me-action-btn me-action-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Attendees Tab ─────────────────────────────────────────────────────────────

function AttendeesTab({ event, registrations, onRefresh }) {
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [flash, setFlash]         = useState(null)

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type })
    setTimeout(() => setFlash(null), 4000)
  }

  const isManual = event.registration_type === 'manual'

  const filtered = useMemo(() => {
    let list = registrations
    if (filter !== 'all') {
      if (filter === 'cancelled') list = list.filter(r => r.status === 'cancelled' || r.status === 'rejected')
      else list = list.filter(r => r.status === filter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        String(r.user_id).includes(q) ||
        String(r.id).includes(q)
      )
    }
    return list
  }, [registrations, filter, search])

  const counts = useMemo(() => ({
    all:       registrations.length,
    confirmed: registrations.filter(r => r.status === 'confirmed').length,
    pending:   registrations.filter(r => r.status === 'pending').length,
    cancelled: registrations.filter(r => r.status === 'cancelled' || r.status === 'rejected').length,
  }), [registrations])

  const handleApprove = async (regId) => {
    setActionLoading(a => ({ ...a, [regId]: 'approve' }))
    try {
      await api.patch(`/api/registrations/${regId}/approve`)
      showFlash('Registration approved.')
      onRefresh()
    } catch (err) {
      showFlash(err.response?.data?.detail || 'Could not approve.', 'error')
    } finally { setActionLoading(a => ({ ...a, [regId]: null })) }
  }

  const handleReject = async (regId) => {
    setActionLoading(a => ({ ...a, [regId]: 'reject' }))
    try {
      await api.patch(`/api/registrations/${regId}/reject`, {})
      showFlash('Registration rejected.')
      onRefresh()
    } catch (err) {
      showFlash(err.response?.data?.detail || 'Could not reject.', 'error')
    } finally { setActionLoading(a => ({ ...a, [regId]: null })) }
  }

  return (
    <div className="me-tab-content">
      {flash && <div className={`me-flash me-flash--${flash.type}`}>{flash.msg}</div>}

      {/* header */}
      <div className="me-attendees-header">
        <input
          className="me-search-input"
          placeholder="Search by registration ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* tabs */}
      <div className="me-filter-tabs">
        {[['all', 'All'], ['confirmed', 'Confirmed'], ['pending', 'Pending'], ['cancelled', 'Cancelled']].map(([v, l]) => (
          <button
            key={v}
            className={`me-filter-tab${filter === v ? ' me-filter-tab--active' : ''}`}
            onClick={() => setFilter(v)}
          >
            {l} ({counts[v] ?? 0})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="me-empty">
          <span className="me-empty-icon"><IcoEmpty /></span>
          <p className="me-empty-title">No registrations{filter !== 'all' ? ` with status "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="me-table-wrap">
          <table className="me-table">
            <thead>
              <tr>
                <th>REG #</th>
                <th>USER ID</th>
                <th>QUANTITY</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th>REGISTERED</th>
                {isManual && <th>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(reg => (
                <tr key={reg.id} className="me-table-row">
                  <td className="me-td-mono">#{reg.id}</td>
                  <td className="me-td-mono">
                    <span className="me-user-pill">User #{reg.user_id}</span>
                  </td>
                  <td>{reg.quantity}</td>
                  <td>
                    {parseFloat(reg.total_amount) === 0
                      ? <span style={{ color: 'var(--text-muted)' }}>Free</span>
                      : `$${parseFloat(reg.total_amount).toFixed(2)}`}
                  </td>
                  <td>
                    <span className="me-status-cell">
                      <span className={`me-dot ${STATUS_DOT[reg.status] ?? 'me-dot--muted'}`} />
                      {reg.status}
                    </span>
                  </td>
                  <td className="me-td-date">{formatDate(reg.registered_at)}</td>
                  {isManual && (
                    <td>
                      {reg.status === 'pending' ? (
                        <div className="me-action-btns">
                          <button
                            className="me-action-btn me-action-btn--approve"
                            onClick={() => handleApprove(reg.id)}
                            disabled={!!actionLoading[reg.id]}
                            title="Approve"
                          >
                            {actionLoading[reg.id] === 'approve' ? '…' : <IcoCheck />}
                          </button>
                          <button
                            className="me-action-btn me-action-btn--reject"
                            onClick={() => handleReject(reg.id)}
                            disabled={!!actionLoading[reg.id]}
                            title="Reject"
                          >
                            {actionLoading[reg.id] === 'reject' ? '…' : <IcoX />}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="me-table-footer">
        Showing {filtered.length} of {registrations.length} registration{registrations.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ── Send Invites Tab ──────────────────────────────────────────────────────────

function SendInvitesTab({ event }) {
  const [email, setEmail]             = useState('')
  const [sending, setSending]         = useState(false)
  const [flash, setFlash]             = useState(null)
  const [invites, setInvites]         = useState([])
  const [loadingList, setLoadingList] = useState(true)

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type })
    setTimeout(() => setFlash(null), 4000)
  }

  const loadInvites = async () => {
    try {
      const res = await inviteApi.listEventInvites(event.id)
      setInvites(res.data)
    } catch {
      // non-critical
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadInvites()
  }, [event.id])

  const handleSend = async () => {
    const trimmed = email.trim()
    if (!trimmed) { showFlash('Please enter an email address.', 'error'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) { showFlash('Please enter a valid email address.', 'error'); return }

    setSending(true)
    try {
      await inviteApi.sendInvite(event.id, trimmed)
      setEmail('')
      showFlash(`Invite sent to ${trimmed}`)
      loadInvites()
    } catch (err) {
      const detail = err.response?.data?.detail
      showFlash(typeof detail === 'string' ? detail : 'Could not send invite.', 'error')
    } finally { setSending(false) }
  }

  const statusBadge = (status) => {
    const styles = {
      pending:  { background: 'rgba(231,233,236,0.08)', color: '#A0A8B0', border: '1px solid rgba(160,168,176,0.3)' },
      accepted: { background: 'rgba(29,158,117,0.12)',  color: '#1D9E75', border: '1px solid rgba(29,158,117,0.3)' },
      declined: { background: 'rgba(220,53,69,0.1)',    color: '#E05260', border: '1px solid rgba(220,53,69,0.3)' },
      expired:  { background: 'rgba(231,233,236,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(160,168,176,0.15)' },
    }
    const s = styles[status] ?? styles.expired
    return (
      <span style={{
        ...s,
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}>
        {status}
      </span>
    )
  }

  return (
    <div className="me-tab-content">
      {flash && <div className={`me-flash me-flash--${flash.type}`}>{flash.msg}</div>}

      <div className="me-invite-box">
        <h3 className="me-invite-title">Send invite</h3>
        <p className="me-invite-sub">
          Invite someone to this event by email. They'll receive a link to register.
          {event.registration_type === 'invite_only' && (
            <span className="me-invite-note"> This event is invite-only — only invited users can register.</span>
          )}
        </p>

        <div className="me-invite-row">
          <input
            className="me-form-input"
            type="email"
            placeholder="attendee@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ flex: 1 }}
          />
          <button
            className="me-action-btn me-action-btn--primary"
            onClick={handleSend}
            disabled={sending || !email.trim()}
            style={{ flexShrink: 0 }}
          >
            <IcoSend /> {sending ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </div>

      {!loadingList && invites.length > 0 && (
        <div className="me-sent-list">
          <p className="me-sent-list-title">Sent invites</p>
          {invites.map(inv => (
            <div key={inv.id} className="me-sent-item">
              <span className="me-sent-email">{inv.email}</span>
              <span className="me-sent-time">{formatDate(inv.sent_at)}</span>
              {statusBadge(inv.status)}
            </div>
          ))}
        </div>
      )}

      <div className="me-invite-info">
        <p className="me-invite-info-title">How invites work</p>
        <ul className="me-invite-info-list">
          <li>The invitee receives an email with a unique registration link</li>
          <li>They must create a TeqEvent account or log in to accept</li>
          <li>Invite links expire after 7 days</li>
          <li>You can send multiple invites to different addresses</li>
        </ul>
      </div>
    </div>
  )
}

// ── Collaborators Tab ─────────────────────────────────────────────────────────

function CollaboratorsTab({ eventId }) {
  const [collaborators, setCollaborators] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    fetchCollaborators()
  }, [eventId])

  const fetchCollaborators = async () => {
    try {
      setLoading(true)
      const res = await collaboratorApi.listCollaborators(eventId)
      setCollaborators(res.data)
    } catch (err) {
      setError('Failed to load collaborators.')
    } finally {
      setLoading(false)
    }
  }

  const extractError = (err, fallback) => {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) return detail[0]?.msg ?? 'Validation error'
    return fallback
  }

  const handleInvite = async () => {
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    setSuccess(null)
    try {
      await collaboratorApi.inviteCollaborator(eventId, email.trim())
      setSuccess(`Invite sent to ${email.trim()}`)
      setEmail('')
      fetchCollaborators()
    } catch (err) {
      setError(extractError(err, 'Failed to send invite.'))
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId) => {
    if (!userId) {
      setError('Cannot remove: user ID missing.')
      return
    }
    if (!window.confirm('Remove this collaborator?')) return
    setRemoving(userId)
    setError(null)
    setSuccess(null)
    try {
      await collaboratorApi.removeCollaborator(eventId, userId)
      await fetchCollaborators()
    } catch (err) {
      setError(extractError(err, 'Failed to remove collaborator.'))
    } finally {
      setRemoving(null)
    }
  }

  const statusBadge = (status) => {
    const styles = {
      accepted: { background: 'rgba(29,158,117,0.12)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.3)' },
      pending:  { background: 'rgba(231,233,236,0.08)', color: '#A0A8B0', border: '1px solid rgba(160,168,176,0.3)' },
      declined: { background: 'rgba(220,53,69,0.1)',   color: '#E05260', border: '1px solid rgba(220,53,69,0.3)' },
    }
    return (
      <span style={{
        ...styles[status],
        padding: '2px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}>
        {status}
      </span>
    )
  }

  return (
    <div className="me-tab-content">
      <div style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Invite an organizer by email to co-manage this event.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="email"
            placeholder="organizer@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className="me-form-input"
            style={{ flex: 1 }}
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            className="me-action-btn me-action-btn--primary"
          >
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        {error   && <p style={{ marginTop: '10px', fontSize: '13px', color: '#E05260' }}>{error}</p>}
        {success && <p style={{ marginTop: '10px', fontSize: '13px', color: '#1D9E75' }}>{success}</p>}
      </div>

      {loading ? (
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading…</p>
      ) : collaborators.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No collaborators yet.</p>
      ) : (
        <div>
          {collaborators.map(c => (
            <div key={c.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 0',
              borderBottom: '1px solid rgba(231,233,236,0.08)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {c.user?.first_name} {c.user?.last_name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {c.user?.email}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {statusBadge(c.status)}
                <button
                  onClick={() => handleRemove(c.user?.id)}
                  disabled={removing === c.user?.id}
                  className="me-action-btn me-action-btn--ghost"
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                >
                  {removing === c.user?.id ? '…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ManageEvent() {
  const navigate = useNavigate()

  const [myEvents, setMyEvents]         = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [categories, setCategories]     = useState([])
  const [currentUserId, setCurrentUserId] = useState(null)
  const [activeTab, setActiveTab]       = useState('overview')
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingEvent, setLoadingEvent] = useState(false)
  const [fetchError, setFetchError]     = useState('')

  const isOwner = selectedEvent && currentUserId && selectedEvent.owner_id === currentUserId

  const TABS = [
    { id: 'overview',      label: 'Overview' },
    { id: 'edit',          label: 'Edit details' },
    { id: 'attendees',     label: `Attendees${registrations.length ? ` (${registrations.length})` : ''}` },
    { id: 'send-invites',  label: 'Send invites' },
    ...(isOwner ? [{ id: 'collaborators', label: 'Collaborators' }] : []),
  ]

  // Load organizer's events + categories
  useEffect(() => {
    let cancelled = false

    Promise.all([
      api.get('/api/auth/me'),
      categoriesApi.list(),
    ])
      .then(([meRes, catsRes]) => {
        if (cancelled) return
        const uid = meRes.data.id
        setCurrentUserId(uid)
        setCategories(catsRes.data ?? [])

        return Promise.all([
          eventsApi.list({ limit: 100 }),
          collaboratorApi.getMyCollaboratingEvents(),
        ]).then(([evRes, collabRes]) => {
          if (cancelled) return
          const items = evRes.data?.items ?? []
          const owned = items.filter(e => e.owner_id === uid)
          const collaborating = collabRes.data ?? []
          const ownedIds = new Set(owned.map(e => e.id))
          const merged = [
            ...owned,
            ...collaborating.filter(e => !ownedIds.has(e.id)),
          ]
          setMyEvents(merged)
          if (merged.length > 0) {
            loadEvent(merged[0].id)
          }
        })
      })
      .catch(() => setFetchError('Failed to load events.'))
      .finally(() => { if (!cancelled) setLoadingList(false) })

    return () => { cancelled = true }
  }, [])

 const loadEvent = async (eventId) => {
  setLoadingEvent(true)
  setRegistrations([])
  setSelectedEvent(null)
  try {
    const [evRes, regsRes] = await Promise.all([
      eventsApi.getById(eventId),
      organizerApi.listEventRegistrations(eventId, { limit: 100 }),
    ])
    setSelectedEvent(evRes.data)
    setRegistrations(regsRes.data?.items ?? [])
  } catch (err) {
    console.error('loadEvent error', err)
  } finally {
    setLoadingEvent(false)
  }
}

  const handleSelectEvent = (event) => {
    setActiveTab('overview')
    loadEvent(event.id)
    // also update selectedEvent in the list with fresh data
    setSelectedEvent(event)
  }

const handleActionDone = () => {
  if (selectedEvent) loadEvent(selectedEvent.id)
  api.get('/api/auth/me').then(meRes => {
    const uid = meRes.data.id
    Promise.all([
      eventsApi.list({ limit: 100 }),
      collaboratorApi.getMyCollaboratingEvents(),
    ]).then(([evRes, collabRes]) => {
      const items = evRes.data?.items ?? []
      const owned = items.filter(e => e.owner_id === uid)
      const collaborating = collabRes.data ?? []
      const collabIds = new Set(owned.map(e => e.id))
      setMyEvents([
        ...owned,
        ...collaborating.filter(e => !collabIds.has(e.id)),
      ])
    })
  }).catch(() => {})
}

  if (loadingList) return <div className="ed-state">Loading…</div>

  if (fetchError) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-msg">{fetchError}</p>
      <button className="reg-btn-secondary" style={{ marginTop: 16, maxWidth: 200 }} onClick={() => window.location.reload()}>Retry</button>
    </div>
  )

  return (
    <div className="me-layout">

      {/* ── left: event list ── */}
      <aside className="me-event-list">
        <div className="me-event-list-head">
          <h2 className="me-event-list-heading">Your events</h2>
          <button className="me-new-btn" onClick={() => navigate('/organizer/create-event')} title="Create new event">
            <IcoPlus />
          </button>
        </div>

        {myEvents.length === 0 ? (
          <div className="me-list-empty">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center', lineHeight: 1.5 }}>
              No events yet.{' '}
              <button
                style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', font: 'inherit', fontSize: 13 }}
                onClick={() => navigate('/organizer/create-event')}
              >
                Create one
              </button>
            </p>
          </div>
        ) : (
          <div className="me-event-list-items">
            {myEvents.map(ev => (
              <EventListItem
                key={ev.id}
                event={ev}
                selected={selectedEvent?.id === ev.id}
                onClick={() => handleSelectEvent(ev)}
              />
            ))}
          </div>
        )}
      </aside>

      {/* ── right: event detail ── */}
      <div className="me-detail-panel">
        {!selectedEvent || loadingEvent ? (
          <div className="ed-state" style={{ height: '60vh' }}>
            {loadingEvent ? 'Loading event…' : 'Select an event to manage it'}
          </div>
        ) : (
          <>
            {/* event header */}
            <div className="me-event-header">
              <div className="me-event-header-left">
                <div className="me-event-header-thumb">
                  {selectedEvent.cover_image
                    ? <img src={`${API_BASE_URL}${selectedEvent.cover_image}`} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                    : <span>{(selectedEvent.title || 'E').slice(0, 3).toUpperCase()}</span>
                  }
                </div>
                <div>
                  <div className="me-event-header-top">
                    <span className={`me-status-pill me-status-pill--${selectedEvent.status}`}>
                      ● {selectedEvent.status}
                    </span>
                  </div>
                  <h1 className="me-event-header-title">{selectedEvent.title}</h1>
                  <div className="me-event-header-meta">
                    {selectedEvent.start_datetime && (
                      <span className="me-event-header-meta-item">
                        <IcoCal /> {formatDate(selectedEvent.start_datetime)}
                      </span>
                    )}
                    <span className="me-event-header-meta-item">
                      <IcoPin /> {getLocation(selectedEvent)}
                    </span>
                    <span className="me-event-header-meta-item">
                      <IcoUsers /> {registrations.length} registered
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* tabs */}
            <div className="me-tabs">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`me-tab${activeTab === tab.id ? ' me-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* tab content */}
            {activeTab === 'overview' && (
              <OverviewTab
                event={selectedEvent}
                registrations={registrations}
                onActionDone={handleActionDone}
              />
            )}
            {activeTab === 'edit' && (
              <EditTab
                event={selectedEvent}
                categories={categories}
                onSaved={handleActionDone}
              />
            )}
            {activeTab === 'attendees' && (
              <AttendeesTab
                event={selectedEvent}
                registrations={registrations}
                onRefresh={() => loadEvent(selectedEvent.id)}
              />
            )}
            {activeTab === 'send-invites' && (
              <SendInvitesTab event={selectedEvent} />
            )}
            {activeTab === 'collaborators' && (
                <CollaboratorsTab eventId={selectedEvent.id} />
            )}
          </>
        )}
      </div>
    </div>
  )
}