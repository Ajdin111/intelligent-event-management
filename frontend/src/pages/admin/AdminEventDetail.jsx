import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  eventsApi, ticketTiersApi, reviewsApi, agendaApi,
  adminApi, collaboratorApi, inviteApi,
} from '../../services/api'
import { COUNTRIES, CITIES_BY_COUNTRY } from '../../data/worldCities'
import NotFound from '../NotFound'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  return `${Math.floor(diffDays / 30)} months ago`
}

function toDatetimeLocal(iso) {
  if (!iso) return ''
  return iso.replace(' ', 'T').slice(0, 16)
}

function fromDatetimeLocal(val) {
  if (!val) return null
  return val.replace('T', ' ') + ':00'
}

function parsePhysicalAddress(str) {
  if (!str) return { street: '', city: '', country: '' }
  const parts = str.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]
    const secondLast = parts[parts.length - 2]
    const matchedCountry = COUNTRIES.find(c => c.toLowerCase() === lastPart.toLowerCase())
    if (matchedCountry) {
      const cities = CITIES_BY_COUNTRY[matchedCountry] ?? []
      const matchedCity = cities.find(c => c.toLowerCase() === secondLast.toLowerCase())
      return {
        street:  parts.slice(0, parts.length - (matchedCity ? 2 : 1)).join(', '),
        city:    matchedCity ?? '',
        country: matchedCountry,
      }
    }
  }
  return { street: str, city: '', country: '' }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function getInitials(firstName, lastName) {
  return `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}` || '?'
}

// ── Small components ──────────────────────────────────────────────────────────

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

const BADGE_MAP = {
  accepted: 'adm-badge--accepted',
  pending:  'adm-badge--pending',
  declined: 'adm-badge--declined',
  expired:  'adm-badge--expired',
}

function Badge({ status }) {
  return (
    <span className={`adm-badge ${BADGE_MAP[status] ?? ''}`}>
      {status}
    </span>
  )
}

const IcoX = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round" />
  </svg>
)

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ event, busy, onClose, onSave }) {
  const parsed = parsePhysicalAddress(event.physical_address)
  const [form, setForm] = useState({
    title:               event.title,
    description:         event.description ?? '',
    location_type:       event.location_type,
    street:              parsed.street,
    city:                parsed.city,
    country:             parsed.country,
    online_link:         event.online_link ?? '',
    start_datetime:      toDatetimeLocal(event.start_datetime),
    end_datetime:        toDatetimeLocal(event.end_datetime),
    capacity:            event.capacity ?? '',
    registration_type:   event.registration_type,
    is_free:             event.is_free,
    feedback_visibility: event.feedback_visibility,
  })
  const [validErr, setValidErr] = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const availableCities = CITIES_BY_COUNTRY[form.country] ?? []

  // lock body scroll and handle Escape
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handler)
    }
  }, [onClose])

  const handleSave = () => {
    const title = form.title.trim()
    if (!title) { setValidErr('Title is required.'); return }
    if (!form.start_datetime) { setValidErr('Start date and time are required.'); return }
    if (!form.end_datetime)   { setValidErr('End date and time are required.'); return }
    if (form.end_datetime <= form.start_datetime) {
      setValidErr('End date must be after start date.'); return
    }
    const isPhysical = form.location_type === 'physical' || form.location_type === 'hybrid'
    const needsLink  = form.location_type === 'online'   || form.location_type === 'hybrid'
    if (isPhysical && !form.country) {
      setValidErr('Country is required for physical and hybrid events.'); return
    }
    if (isPhysical && availableCities.length > 0 && !form.city) {
      setValidErr('Please select a city.'); return
    }
    if (needsLink && !form.online_link.trim()) {
      setValidErr('An online link is required for online and hybrid events.'); return
    }
    if (form.capacity !== '' && (isNaN(Number(form.capacity)) || Number(form.capacity) < 1)) {
      setValidErr('Capacity must be a positive whole number, or leave blank for unlimited.'); return
    }
    setValidErr('')

    const physicalParts = [form.street.trim(), form.city, form.country].filter(Boolean)
    const physical_address = isPhysical && physicalParts.length > 0 ? physicalParts.join(', ') : null

    const payload = {
      title,
      description:         form.description.trim() || undefined,
      location_type:       form.location_type,
      physical_address,
      online_link:         form.online_link.trim() || null,
      start_datetime:      fromDatetimeLocal(form.start_datetime),
      end_datetime:        fromDatetimeLocal(form.end_datetime),
      capacity:            form.capacity === '' ? null : Number(form.capacity),
      registration_type:   form.registration_type,
      is_free:             form.is_free,
      feedback_visibility: form.feedback_visibility,
    }
    onSave(payload)
  }

  const showAddress = form.location_type === 'physical' || form.location_type === 'hybrid'
  const showLink    = form.location_type === 'online'   || form.location_type === 'hybrid'

  return (
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div className="adm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="adm-modal-header">
          <h2 className="adm-modal-title">Edit event</h2>
          <button className="adm-modal-close" onClick={onClose} type="button" aria-label="Close">
            <IcoX />
          </button>
        </div>

        <div className="adm-modal-body">
          <div className="adm-form-group">
            <label className="adm-form-label">Title</label>
            <input
              className="adm-form-input"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Event title"
            />
          </div>

          <div className="adm-form-group">
            <label className="adm-form-label">Description</label>
            <textarea
              className="adm-form-textarea"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Event description"
            />
          </div>

          <div className="adm-form-row">
            <div className="adm-form-group">
              <label className="adm-form-label">Start date &amp; time</label>
              <input
                className="adm-form-input"
                type="datetime-local"
                value={form.start_datetime}
                onChange={e => set('start_datetime', e.target.value)}
              />
            </div>
            <div className="adm-form-group">
              <label className="adm-form-label">End date &amp; time</label>
              <input
                className="adm-form-input"
                type="datetime-local"
                value={form.end_datetime}
                onChange={e => set('end_datetime', e.target.value)}
              />
            </div>
          </div>

          <div className="adm-form-row">
            <div className="adm-form-group">
              <label className="adm-form-label">Location type</label>
              <select
                className="adm-form-select"
                value={form.location_type}
                onChange={e => set('location_type', e.target.value)}
              >
                <option value="physical">Physical</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-form-label">Capacity (blank = unlimited)</label>
              <input
                className="adm-form-input"
                type="number"
                min="1"
                value={form.capacity}
                onChange={e => set('capacity', e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>

          {showAddress && (
            <>
              <div className="adm-form-group">
                <label className="adm-form-label">Street address / venue</label>
                <input
                  className="adm-form-input"
                  value={form.street}
                  onChange={e => set('street', e.target.value)}
                  placeholder="e.g. 221B Baker Street or Convention Center Hall A"
                />
              </div>
              <div className="adm-form-row">
                <div className="adm-form-group">
                  <label className="adm-form-label">Country</label>
                  <select
                    className="adm-form-select"
                    value={form.country}
                    onChange={e => { set('country', e.target.value); set('city', '') }}
                  >
                    <option value="">— Select country —</option>
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="adm-form-group">
                  <label className="adm-form-label">City</label>
                  <select
                    className="adm-form-select"
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                    disabled={!form.country || availableCities.length === 0}
                  >
                    <option value="">
                      {!form.country ? '— Select country first —' : availableCities.length === 0 ? '— No cities listed —' : '— Select city —'}
                    </option>
                    {availableCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {showLink && (
            <div className="adm-form-group">
              <label className="adm-form-label">Online link</label>
              <input
                className="adm-form-input"
                value={form.online_link}
                onChange={e => set('online_link', e.target.value)}
                placeholder="https://meet.example.com/..."
              />
            </div>
          )}

          <div className="adm-form-row">
            <div className="adm-form-group">
              <label className="adm-form-label">Registration type</label>
              <select
                className="adm-form-select"
                value={form.registration_type}
                onChange={e => set('registration_type', e.target.value)}
              >
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
                <option value="invite_only">Invite only</option>
              </select>
            </div>
            <div className="adm-form-group">
              <label className="adm-form-label">Feedback visibility</label>
              <select
                className="adm-form-select"
                value={form.feedback_visibility}
                onChange={e => set('feedback_visibility', e.target.value)}
              >
                <option value="public">Public</option>
                <option value="organizer_only">Organizer only</option>
              </select>
            </div>
          </div>

          <div className="adm-form-group">
            <label className="adm-form-label">Pricing</label>
            <div className="adm-form-toggle-row">
              <button
                type="button"
                className={`adm-form-toggle-btn${form.is_free ? ' adm-form-toggle-btn--active' : ''}`}
                onClick={() => set('is_free', true)}
              >
                Free
              </button>
              <button
                type="button"
                className={`adm-form-toggle-btn${!form.is_free ? ' adm-form-toggle-btn--active' : ''}`}
                onClick={() => set('is_free', false)}
              >
                Paid
              </button>
            </div>
          </div>
        </div>

        <div className="adm-modal-footer">
          {validErr && <p className="adm-modal-val-err">{validErr}</p>}
          <button className="adm-btn-secondary" onClick={onClose} type="button" disabled={busy === 'edit'}>
            Cancel
          </button>
          <button className="adm-btn-primary" onClick={handleSave} type="button" disabled={busy === 'edit'}>
            {busy === 'edit' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminEventDetail() {
  const { eventId } = useParams()
  const navigate    = useNavigate()

  const [event, setEvent]               = useState(null)
  const [tiers, setTiers]               = useState([])
  const [reviews, setReviews]           = useState([])
  const [agendaTracks, setAgendaTracks] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [invites, setInvites]           = useState([])
  const [analytics, setAnalytics]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)
  const [error, setError]               = useState(false)
  const [notice, setNotice]             = useState('')
  const [busy, setBusy]                 = useState(null)
  const [editOpen, setEditOpen]         = useState(false)
  const [collabEmail, setCollabEmail]   = useState('')
  const [collabNotice, setCollabNotice] = useState({ msg: '', ok: false })
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteNotice, setInviteNotice] = useState({ msg: '', ok: false })
  const noticeTimer = useRef(null)

  const numId     = Number(eventId)
  const invalidId = !eventId || !Number.isInteger(numId) || numId <= 0

  // ── initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (invalidId) { setNotFound(true); setLoading(false); return }

    Promise.all([
      adminApi.getEventDetail(numId),
      ticketTiersApi.listByEvent(numId).catch(() => ({ data: [] })),
      reviewsApi.listByEvent(numId).then(r => r.data).catch(() => []),
      agendaApi.listTracks(numId).then(r => r.data).catch(() => []),
      agendaApi.listSessions(numId).then(r => r.data).catch(() => []),
      collaboratorApi.listCollaborators(numId).then(r => r.data).catch(() => []),
      inviteApi.listEventInvites(numId).then(r => r.data).catch(() => []),
      adminApi.getEventAnalytics(numId).then(r => r.data).catch(() => null),
    ])
      .then(([evRes, tiersRes, rawReviews, rawTracks, rawSessions, rawCollabs, rawInvites, rawAnalytics]) => {
        setEvent(evRes.data)
        setTiers(Array.isArray(tiersRes.data) ? tiersRes.data : [])
        setReviews(Array.isArray(rawReviews) ? rawReviews : [])
        setCollaborators(Array.isArray(rawCollabs) ? rawCollabs : [])
        setInvites(Array.isArray(rawInvites) ? rawInvites : [])
        setAnalytics(rawAnalytics)

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

  // ── helpers ─────────────────────────────────────────────────────────────────

  const showNotice = (msg) => {
    clearTimeout(noticeTimer.current)
    setNotice(msg)
    noticeTimer.current = setTimeout(() => setNotice(''), 5000)
  }

  const refreshEvent = async () => {
    try {
      const fresh = await adminApi.getEventDetail(numId)
      setEvent(fresh.data)
    } catch (_) {}
  }

  // ── actions ─────────────────────────────────────────────────────────────────

  const publish = async () => {
    setBusy('publish')
    try {
      await eventsApi.publish(numId)
      await refreshEvent()
      showNotice('Event published successfully.')
    } catch (err) {
      showNotice(normalizeError(err, 'Failed to publish event.'))
    } finally {
      setBusy(null)
    }
  }

  const unpublish = async () => {
    setBusy('unpublish')
    try {
      await adminApi.unpublishEvent(numId)
      await refreshEvent()
      showNotice('Event unpublished successfully.')
    } catch (err) {
      showNotice(normalizeError(err, 'Failed to unpublish event.'))
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
      showNotice(normalizeError(err, 'Failed to delete event.'))
      setBusy(null)
    }
  }

  const saveEdit = async (payload) => {
    setBusy('edit')
    try {
      await eventsApi.update(numId, payload)
      await refreshEvent()
      setEditOpen(false)
      showNotice('Event updated successfully.')
    } catch (err) {
      showNotice(normalizeError(err, 'Failed to update event.'))
    } finally {
      setBusy(null)
    }
  }

  const addCollaborator = async () => {
    const email = collabEmail.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setCollabNotice({ msg: 'Please enter a valid email address.', ok: false }); return
    }
    if (event.owner_email && email === event.owner_email.toLowerCase()) {
      setCollabNotice({ msg: 'The event owner cannot be added as a collaborator.', ok: false }); return
    }
    const existing = collaborators.find(c => c.user.email.toLowerCase() === email)
    if (existing?.status === 'accepted') {
      setCollabNotice({ msg: 'This person is already a collaborator on this event.', ok: false }); return
    }
    if (existing?.status === 'pending') {
      setCollabNotice({ msg: 'A collaborator invite is already pending for this email.', ok: false }); return
    }
    setBusy('collab-add')
    setCollabNotice({ msg: '', ok: false })
    try {
      await collaboratorApi.inviteCollaborator(numId, email)
      const fresh = await collaboratorApi.listCollaborators(numId).then(r => r.data).catch(() => collaborators)
      setCollaborators(fresh)
      setCollabEmail('')
      setCollabNotice({ msg: 'Collaborator invite sent.', ok: true })
    } catch (err) {
      setCollabNotice({ msg: normalizeError(err, 'Failed to add collaborator.'), ok: false })
    } finally {
      setBusy(null)
    }
  }

  const removeCollaborator = async (userId) => {
    setBusy(`collab-${userId}`)
    setCollabNotice({ msg: '', ok: false })
    try {
      await collaboratorApi.removeCollaborator(numId, userId)
      setCollaborators(prev => prev.filter(c => c.user.id !== userId))
    } catch (err) {
      setCollabNotice({ msg: normalizeError(err, 'Failed to remove collaborator.'), ok: false })
    } finally {
      setBusy(null)
    }
  }

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    if (!EMAIL_RE.test(email)) {
      setInviteNotice({ msg: 'Please enter a valid email address.', ok: false }); return
    }
    const existingInvite = invites.find(inv => inv.email.toLowerCase() === email)
    if (existingInvite?.status === 'pending') {
      setInviteNotice({ msg: 'An invite is already pending for this email.', ok: false }); return
    }
    if (existingInvite?.status === 'accepted') {
      setInviteNotice({ msg: 'This person has already accepted an invite to this event.', ok: false }); return
    }
    setBusy('invite-send')
    setInviteNotice({ msg: '', ok: false })
    try {
      await inviteApi.sendInvite(numId, email)
      const fresh = await inviteApi.listEventInvites(numId).then(r => r.data).catch(() => invites)
      setInvites(fresh)
      setInviteEmail('')
      setInviteNotice({ msg: 'Invite sent successfully.', ok: true })
    } catch (err) {
      setInviteNotice({ msg: normalizeError(err, 'Failed to send invite.'), ok: false })
    } finally {
      setBusy(null)
    }
  }

  // ── render guards ────────────────────────────────────────────────────────────

  if (loading)  return <div className="ed-state">Loading…</div>
  if (notFound) return <NotFound />
  if (error)    return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load event.</p>
    </div>
  )

  // ── computed ─────────────────────────────────────────────────────────────────

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

  const ownerName = event.owner_first_name
    ? `${event.owner_first_name} ${event.owner_last_name}`
    : null

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="adm-wrap">

      {editOpen && (
        <EditModal
          event={event}
          busy={busy}
          onClose={() => setEditOpen(false)}
          onSave={saveEdit}
        />
      )}

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
            {ownerName
              ? ` · ${ownerName}${event.owner_email ? ` (${event.owner_email})` : ''}`
              : ` · Owner #${event.owner_id}`}
          </p>
        </div>
        <div className="adm-header-actions">
          <button
            className="adm-btn-secondary"
            onClick={() => setEditOpen(true)}
            disabled={!!busy}
            type="button"
          >
            Edit
          </button>
          {event.status === 'draft' && (
            <button
              className="adm-btn-secondary adm-btn-publish"
              onClick={publish}
              disabled={!!busy}
              type="button"
            >
              {busy === 'publish' ? '…' : 'Publish'}
            </button>
          )}
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

      {notice && <p className="adm-page-notice">{notice}</p>}

      {/* ── two-column body ── */}
      <div className="adm-evd-body">

        {/* ── main column: content ── */}
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
                      <span className="adm-evd-track-count">
                        · {track.sessions.length} session{track.sessions.length !== 1 ? 's' : ''}
                      </span>
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

        {/* ── sidebar: facts, analytics, tiers, collaborators, invites ── */}
        <aside className="adm-evd-side">

          {/* event details */}
          <div className="adm-evd-info-card">
            <h3 className="adm-evd-info-title">Event details</h3>
            <dl className="adm-evd-facts">
              <div><dt>Status</dt><dd><StatusPill status={event.status} /></dd></div>
              {ownerName ? (
                <>
                  <div><dt>Organizer</dt><dd>{ownerName}</dd></div>
                  {event.owner_email && (
                    <div><dt>Email</dt><dd style={{ wordBreak: 'break-all' }}>{event.owner_email}</dd></div>
                  )}
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
              {event.online_link && (
                <div>
                  <dt>Online link</dt>
                  <dd style={{ wordBreak: 'break-all' }}>
                    <a href={event.online_link} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                      {event.online_link}
                    </a>
                  </dd>
                </div>
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

          {/* analytics */}
          {analytics && (
            <div className="adm-evd-info-card">
              <h3 className="adm-evd-info-title">Analytics</h3>
              <div className="adm-evd-analytics">
                <div className="adm-evd-analytic">
                  <span className="adm-evd-analytic-val">{analytics.total_registrations ?? '—'}</span>
                  <span className="adm-evd-analytic-label">Registrations</span>
                </div>
                <div className="adm-evd-analytic">
                  <span className="adm-evd-analytic-val">{analytics.total_checked_in ?? '—'}</span>
                  <span className="adm-evd-analytic-label">Checked in</span>
                </div>
                <div className="adm-evd-analytic">
                  <span className="adm-evd-analytic-val">
                    {analytics.attendance_rate != null
                      ? `${Math.round(parseFloat(analytics.attendance_rate))}%`
                      : '—'}
                  </span>
                  <span className="adm-evd-analytic-label">Attendance</span>
                </div>
                <div className="adm-evd-analytic">
                  <span className="adm-evd-analytic-val">
                    {analytics.total_revenue != null
                      ? `$${parseFloat(analytics.total_revenue).toLocaleString()}`
                      : '—'}
                  </span>
                  <span className="adm-evd-analytic-label">Revenue</span>
                </div>
              </div>
            </div>
          )}

          {/* ticket tiers */}
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

          {/* collaborators */}
          <div className="adm-evd-info-card">
            <h3 className="adm-evd-info-title">Collaborators</h3>

            {collaborators.length > 0 && (
              <ul className="adm-evd-member-list">
                {collaborators.map(c => (
                  <li key={c.id} className="adm-evd-member">
                    <div className="adm-evd-member-avatar">
                      {getInitials(c.user.first_name, c.user.last_name)}
                    </div>
                    <div className="adm-evd-member-info">
                      <span className="adm-evd-member-name">
                        {c.user.first_name} {c.user.last_name}
                      </span>
                      <span className="adm-evd-member-email">{c.user.email}</span>
                    </div>
                    <Badge status={c.status} />
                    <button
                      className="adm-evd-remove-btn"
                      onClick={() => removeCollaborator(c.user.id)}
                      disabled={!!busy}
                      title="Remove collaborator"
                      type="button"
                    >
                      <IcoX />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {collaborators.length === 0 && (
              <p className="adm-evd-p adm-evd-p--muted" style={{ marginBottom: 10 }}>
                No collaborators yet.
              </p>
            )}

            <div className="adm-evd-add-row">
              <input
                className="adm-evd-add-input"
                type="email"
                placeholder="Organizer's email"
                value={collabEmail}
                onChange={e => { setCollabEmail(e.target.value); setCollabNotice({ msg: '', ok: false }) }}
                onKeyDown={e => e.key === 'Enter' && addCollaborator()}
              />
              <button
                className="adm-evd-add-btn"
                onClick={addCollaborator}
                disabled={!!busy || !collabEmail.trim()}
                type="button"
              >
                {busy === 'collab-add' ? '…' : 'Add'}
              </button>
            </div>
            <p className="adm-evd-input-hint">User must have an organizer role on the platform.</p>
            {collabNotice.msg && (
              <p className={`adm-evd-sub-notice${collabNotice.ok ? ' adm-evd-sub-notice--ok' : ' adm-evd-sub-notice--error'}`}>
                {collabNotice.msg}
              </p>
            )}
          </div>

          {/* invites */}
          <div className="adm-evd-info-card">
            <h3 className="adm-evd-info-title">Invites</h3>

            {invites.length > 0 && (
              <ul className="adm-evd-member-list">
                {invites.map(inv => (
                  <li key={inv.id} className="adm-evd-member">
                    <div className="adm-evd-member-avatar" style={{ fontSize: 9 }}>
                      {inv.user
                        ? getInitials(inv.user.first_name, inv.user.last_name)
                        : inv.email[0].toUpperCase()}
                    </div>
                    <div className="adm-evd-member-info">
                      {inv.user && (
                        <span className="adm-evd-member-name">
                          {inv.user.first_name} {inv.user.last_name}
                        </span>
                      )}
                      <span className="adm-evd-member-email">{inv.email}</span>
                    </div>
                    <Badge status={inv.status} />
                  </li>
                ))}
              </ul>
            )}

            {invites.length === 0 && (
              <p className="adm-evd-p adm-evd-p--muted" style={{ marginBottom: 10 }}>
                No invites sent yet.
              </p>
            )}

            <div className="adm-evd-add-row">
              <input
                className="adm-evd-add-input"
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteNotice({ msg: '', ok: false }) }}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
              />
              <button
                className="adm-evd-add-btn"
                onClick={sendInvite}
                disabled={!!busy || !inviteEmail.trim()}
                type="button"
              >
                {busy === 'invite-send' ? '…' : 'Send'}
              </button>
            </div>
            {inviteNotice.msg && (
              <p className={`adm-evd-sub-notice${inviteNotice.ok ? ' adm-evd-sub-notice--ok' : ' adm-evd-sub-notice--error'}`}>
                {inviteNotice.msg}
              </p>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}
