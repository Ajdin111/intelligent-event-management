import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { agendaApi, eventsApi, collaboratorApi, API_BASE_URL } from '../../services/api'

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID_START  = 8 * 60    // 08:00
const GRID_END    = 22 * 60   // 22:00
const PX_PER_MIN  = 1.5
const SNAP        = 15
const GRID_H      = (GRID_END - GRID_START) * PX_PER_MIN  // 1260px
const MIN_CARD_H  = 28

const TRACK_COLORS = ['#5B8AF5','#2EC4B6','#A78BFA','#F59E0B','#F87171','#34D399','#FB923C','#60A5FA']

// ─── Icons ────────────────────────────────────────────────────────────────────
const IcoPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="6.5" y1="1.5" x2="6.5" y2="11.5" strokeLinecap="round"/>
    <line x1="1.5" y1="6.5" x2="11.5" y2="6.5" strokeLinecap="round"/>
  </svg>
)
const IcoDrag = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" opacity="0.4">
    <circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>
    <circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/>
    <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
  </svg>
)
const IcoEdit = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6Z" strokeLinejoin="round"/>
  </svg>
)
const IcoTrash = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1.5 3h9M4 3V2a.5.5 0 0 1 .5-.5h3A.5.5 0 0 1 8 2v1M5 5.5v4M7 5.5v4M2 3l.7 7a.5.5 0 0 0 .5.5h5.6a.5.5 0 0 0 .5-.5L10 3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoWarn = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7 1.5L13 12.5H1L7 1.5Z" strokeLinejoin="round"/>
    <line x1="7" y1="5.5" x2="7" y2="8.5" strokeLinecap="round"/>
    <circle cx="7" cy="10.5" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
)
const IcoChevRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IcoCal = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="11" height="10" rx="1.2"/>
    <line x1="0.5" y1="4.5" x2="11.5" y2="4.5"/>
    <line x1="3.5" y1="0" x2="3.5" y2="3" strokeLinecap="round"/>
    <line x1="8.5" y1="0" x2="8.5" y2="3" strokeLinecap="round"/>
  </svg>
)
const IcoEye = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 6.5C1 6.5 3 2.5 6.5 2.5S12 6.5 12 6.5 10 10.5 6.5 10.5 1 6.5 1 6.5Z"/>
    <circle cx="6.5" cy="6.5" r="1.8"/>
  </svg>
)
const IcoX = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8">
    <line x1="3" y1="3" x2="10" y2="10" strokeLinecap="round"/>
    <line x1="10" y1="3" x2="3" y2="10" strokeLinecap="round"/>
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toMinutes(iso) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
function minutesToHHMM(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function getISODate(iso) {
  if (!iso) return new Date().toISOString().split('T')[0]
  return iso.split('T')[0]
}
function buildNaiveDatetime(dateStr, totalMinutes) {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const m = String(totalMinutes % 60).padStart(2, '0')
  return `${dateStr}T${h}:${m}:00`
}
function snapMinutes(raw) {
  return Math.round(raw / SNAP) * SNAP
}
function clampMinutes(m) {
  return Math.max(GRID_START, Math.min(GRID_END - 30, m))
}
function formatDisplayTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function durationLabel(iso1, iso2) {
  const diff = (new Date(iso2) - new Date(iso1)) / 60000
  if (diff < 60) return `${diff}m`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
function detectConflicts(sessions) {
  const conflicts = new Set()
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i], b = sessions[j]
      if (a.track_id !== b.track_id) continue
      const aStart = new Date(a.start_datetime), aEnd = new Date(a.end_datetime)
      const bStart = new Date(b.start_datetime), bEnd = new Date(b.end_datetime)
      if (aStart < bEnd && aEnd > bStart) {
        conflicts.add(a.id)
        conflicts.add(b.id)
      }
    }
  }
  return conflicts
}

// ─── Event List Item ──────────────────────────────────────────────────────────
function EventListItem({ event, selected, onClick, onDismiss }) {
  const color = { published: '#4ade80', draft: 'rgba(255,255,255,0.35)', cancelled: '#f87171', closed: 'rgba(255,255,255,0.35)' }[event.status] ?? 'rgba(255,255,255,0.35)'
  return (
    <button className={`me-event-list-item${selected ? ' me-event-list-item--active' : ''}`} onClick={onClick}>
      <div className="me-event-list-item-left">
        <div className="me-event-list-thumb">
          {event.cover_image
            ? <img src={`${API_BASE_URL}${event.cover_image}`} alt="" onError={e => { e.currentTarget.style.display = 'none' }}/>
            : <span>{(event.title || 'E').slice(0, 3).toUpperCase()}</span>
          }
        </div>
        <div className="me-event-list-info">
          <p className="me-event-list-title">{event.title}</p>
          <div className="me-event-list-meta">
            <span style={{ color, fontSize: 11, fontWeight: 500 }}>● {event.status}</span>
            {event.start_datetime && (
              <span className="me-event-list-date"><IcoCal /> {new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            )}
          </div>
        </div>
      </div>
      {event.status === 'cancelled' && onDismiss ? (
        <span
          className="me-event-list-dismiss"
          role="button"
          title="Remove from list"
          onClick={e => { e.stopPropagation(); onDismiss(event.id) }}
        ><IcoX /></span>
      ) : (
        <IcoChevRight />
      )}
    </button>
  )
}

// ─── Track Modal ──────────────────────────────────────────────────────────────
function TrackModal({ track, onSave, onClose }) {
  const [form, setForm] = useState({ name: track?.name ?? '', color: track?.color ?? TRACK_COLORS[0], description: track?.description ?? '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setErr('Track name is required.'); return }
    setSaving(true); setErr('')
    try { await onSave(form) }
    catch (e) { setErr(e.response?.data?.detail ?? 'Could not save track.'); setSaving(false) }
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="ag-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') { e.preventDefault(); handleSave() } }}>
        <div className="ag-modal-head">
          <h2 className="ag-modal-title">{track ? 'Edit track' : 'Add track'}</h2>
          <button className="ag-modal-close" onClick={onClose}><IcoX /></button>
        </div>
        {err && <div className="ag-flash ag-flash--error">{err}</div>}
        <div className="ag-modal-body">
          <div className="ag-form-group">
            <label className="ag-form-label">Track name <span className="ag-required">*</span></label>
            <input className="ag-form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main Stage" autoFocus />
          </div>
          <div className="ag-form-group">
            <label className="ag-form-label">Color</label>
            <div className="ag-color-row">
              {TRACK_COLORS.map(c => (
                <button key={c} className={`ag-color-swatch${form.color === c ? ' ag-color-swatch--active' : ''}`}
                  style={{ background: c }} onClick={() => set('color', c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="ag-form-group">
            <label className="ag-form-label">Description <span className="ag-optional">(optional)</span></label>
            <input className="ag-form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description" />
          </div>
        </div>
        <div className="ag-modal-foot">
          <button className="ag-btn ag-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (track ? 'Save changes' : 'Add track')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Session Modal ────────────────────────────────────────────────────────────
function SessionModal({ session, tracks, eventDate, defaultTrackId, defaultTime, onSave, onClose }) {
  const defaultStartMin = defaultTime ?? GRID_START
  const defaultEndMin   = defaultStartMin + 60

  const initDate  = session ? getISODate(session.start_datetime) : (eventDate ?? new Date().toISOString().split('T')[0])
  const initStart = session ? formatDisplayTime(session.start_datetime) : minutesToHHMM(defaultStartMin)
  const initEnd   = session ? formatDisplayTime(session.end_datetime)   : minutesToHHMM(defaultEndMin)

  const [form, setForm] = useState({
    title:                 session?.title ?? '',
    track_id:              session?.track_id ?? defaultTrackId ?? tracks[0]?.id ?? '',
    date:                  initDate,
    start_time:            initStart,
    end_time:              initEnd,
    speaker_name:          session?.speaker_name ?? '',
    location:              session?.location ?? '',
    description:           session?.description ?? '',
    capacity:              session?.capacity ? String(session.capacity) : '',
    requires_registration: session?.requires_registration ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) { setErr('Title is required.'); return }
    if (!form.track_id)     { setErr('Please select a track.'); return }
    if (!form.date)         { setErr('Date is required.'); return }
    if (!form.start_time)   { setErr('Start time is required.'); return }
    if (!form.end_time)     { setErr('End time is required.'); return }

    const start = new Date(`${form.date}T${form.start_time}`)
    const end   = new Date(`${form.date}T${form.end_time}`)
    if (end <= start) { setErr('End time must be after start time.'); return }

    setSaving(true); setErr('')
    try {
      await onSave({
        title:                 form.title.trim(),
        track_id:              Number(form.track_id),
        start_datetime:        `${form.date}T${form.start_time}:00`,
        end_datetime:          `${form.date}T${form.end_time}:00`,
        speaker_name:          form.speaker_name.trim() || null,
        location:              form.location.trim() || null,
        description:           form.description.trim() || null,
        capacity:              form.capacity ? parseInt(form.capacity) : null,
        requires_registration: form.requires_registration,
      })
    } catch (e) {
      setErr(e.response?.data?.detail ?? 'Could not save session.')
      setSaving(false)
    }
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="ag-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ag-modal ag-modal--wide" onKeyDown={e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON') { e.preventDefault(); handleSave() } }}>
        <div className="ag-modal-head">
          <h2 className="ag-modal-title">{session ? 'Edit session' : 'Add session'}</h2>
          <button className="ag-modal-close" onClick={onClose}><IcoX /></button>
        </div>
        {err && <div className="ag-flash ag-flash--error">{err}</div>}
        <div className="ag-modal-body">
          <div className="ag-form-group">
            <label className="ag-form-label">Session title <span className="ag-required">*</span></label>
            <input className="ag-form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Opening Keynote" autoFocus />
          </div>

          <div className="ag-form-group">
            <label className="ag-form-label">Track <span className="ag-required">*</span></label>
            {session ? (
              <div className="ag-form-input" style={{ color: 'var(--text-sub)', cursor: 'default' }}>
                {tracks.find(t => t.id === form.track_id)?.name ?? '—'}
              </div>
            ) : (
              <select className="ag-form-input ag-form-select" value={form.track_id} onChange={e => set('track_id', e.target.value)}>
                <option value="">Select track…</option>
                {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>

          <div className="ag-form-row">
            <div className="ag-form-group">
              <label className="ag-form-label">Date <span className="ag-required">*</span></label>
              <input className="ag-form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="ag-form-group">
              <label className="ag-form-label">Start time <span className="ag-required">*</span></label>
              <input className="ag-form-input" type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} />
            </div>
            <div className="ag-form-group">
              <label className="ag-form-label">End time <span className="ag-required">*</span></label>
              <input className="ag-form-input" type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} />
            </div>
          </div>

          <div className="ag-form-row">
            <div className="ag-form-group">
              <label className="ag-form-label">Speaker <span className="ag-optional">(optional)</span></label>
              <input className="ag-form-input" value={form.speaker_name} onChange={e => set('speaker_name', e.target.value)} placeholder="Speaker name" />
            </div>
            <div className="ag-form-group">
              <label className="ag-form-label">Location <span className="ag-optional">(optional)</span></label>
              <input className="ag-form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Hall A, Lab 1" />
            </div>
          </div>

          <div className="ag-form-group">
            <label className="ag-form-label">Description <span className="ag-optional">(optional)</span></label>
            <textarea className="ag-form-input ag-form-textarea" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief session description" />
          </div>

          <div className="ag-form-row">
            <div className="ag-form-group">
              <label className="ag-form-label">Capacity <span className="ag-optional">(optional)</span></label>
              <input className="ag-form-input" type="number" min="1" value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="Unlimited" />
            </div>
            <div className="ag-form-group ag-form-group--toggle">
              <div>
                <label className="ag-form-label" style={{ marginBottom: 2 }}>Requires registration</label>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Attendees must register for this session</p>
              </div>
              <button className={`toggle-switch${form.requires_registration ? ' on' : ''}`} onClick={() => set('requires_registration', !form.requires_registration)} />
            </div>
          </div>
        </div>
        <div className="ag-modal-foot">
          <button className="ag-btn ag-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ag-btn ag-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (session ? 'Save changes' : 'Add session')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Time Grid ────────────────────────────────────────────────────────────────
function AgendaGrid({ tracks, sessions, eventDate, conflicts, onEditSession, onDeleteSession, onAddSession, onDrop }) {
  const dragRef   = useRef(null)
  const [dragPreview, setDragPreview] = useState(null)

  const hours = []
  for (let m = GRID_START; m <= GRID_END; m += 60) hours.push(m)
  const halfHours = []
  for (let m = GRID_START + 30; m < GRID_END; m += 60) halfHours.push(m)

  const sessionsByTrack = useMemo(() => {
    const map = {}
    tracks.forEach(t => { map[t.id] = [] })
    sessions.forEach(s => {
      if (map[s.track_id]) map[s.track_id].push(s)
    })
    return map
  }, [tracks, sessions])

  const handleDragStart = useCallback((e, session) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const grabOffsetY = e.clientY - rect.top
    dragRef.current = { session, grabOffsetY }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(session.id))
  }, [])

  const handleDragOver = useCallback((e, trackId) => {
    e.preventDefault()
    if (!dragRef.current) return
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const rawY  = e.clientY - rect.top - dragRef.current.grabOffsetY
    const rawMin = GRID_START + rawY / PX_PER_MIN
    const snapped = clampMinutes(snapMinutes(rawMin))
    setDragPreview({ trackId, startMinutes: snapped })
  }, [])

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragPreview(null)
    }
  }, [])

  const handleDrop = useCallback(async (e, trackId) => {
    e.preventDefault()
    if (!dragRef.current || !dragPreview) { setDragPreview(null); return }
    const { session } = dragRef.current
    const duration = toMinutes(session.end_datetime) - toMinutes(session.start_datetime)
    if (duration <= 0) { setDragPreview(null); dragRef.current = null; return }
    const newStart = dragPreview.startMinutes
    const newEnd   = newStart + duration
    if (newEnd > GRID_END) { setDragPreview(null); dragRef.current = null; return }
    const newStartDt = buildNaiveDatetime(getISODate(session.start_datetime), newStart)
    const newEndDt   = buildNaiveDatetime(getISODate(session.end_datetime),   newEnd)
    setDragPreview(null)
    dragRef.current = null
    await onDrop(session, newStartDt, newEndDt, trackId)
  }, [dragPreview, onDrop])

  const handleDragEnd = useCallback(() => {
    setDragPreview(null)
    dragRef.current = null
  }, [])

  const handleGridClick = useCallback((e, trackId) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const rawMin = GRID_START + (e.clientY - rect.top) / PX_PER_MIN
    const snapped = clampMinutes(snapMinutes(rawMin))
    onAddSession(trackId, snapped)
  }, [onAddSession])

  if (tracks.length === 0) {
    return (
      <div className="ag-empty-state">
        <div className="ag-empty-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.3">
            <rect x="4" y="8" width="32" height="26" rx="3"/>
            <line x1="4" y1="15" x2="36" y2="15"/>
            <line x1="12" y1="4" x2="12" y2="12" strokeLinecap="round"/>
            <line x1="28" y1="4" x2="28" y2="12" strokeLinecap="round"/>
            <line x1="14" y1="24" x2="26" y2="24" strokeLinecap="round"/>
            <line x1="14" y1="29" x2="22" y2="29" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="ag-empty-title">No tracks yet</p>
        <p className="ag-empty-sub">Add a track to start building your agenda.</p>
      </div>
    )
  }

  return (
    <div className="ag-grid-wrap">
      {/* Column headers */}
      <div className="ag-grid-header">
        <div className="ag-time-gutter" />
        {tracks.map(track => (
          <div key={track.id} className="ag-track-header" style={{ borderTop: `3px solid ${track.color || '#5B8AF5'}` }}>
            <div className="ag-track-header-left">
              <span className="ag-track-name">{track.name}</span>
              {track.description && <span className="ag-track-desc">{track.description}</span>}
              <span className="ag-track-count">{(sessionsByTrack[track.id] || []).length} session{(sessionsByTrack[track.id] || []).length !== 1 ? 's' : ''}</span>
            </div>
            <button className="ag-track-add-btn" onClick={() => onAddSession(track.id, null)} title="Add session">
              <IcoPlus />
            </button>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="ag-grid-body" style={{ height: GRID_H }}>
        {/* Time gutter */}
        <div className="ag-time-gutter ag-time-gutter--body">
          {hours.map(m => m === GRID_START ? null : (
            <div key={m} className="ag-time-label" style={{ top: (m - GRID_START) * PX_PER_MIN }}>
              {minutesToHHMM(m)}
            </div>
          ))}
          {halfHours.map(m => (
            <div key={`h${m}`} className="ag-time-label ag-time-label--half" style={{ top: (m - GRID_START) * PX_PER_MIN }}>
              {minutesToHHMM(m)}
            </div>
          ))}
        </div>

        {/* Track columns */}
        {tracks.map(track => {
          const trackSessions = (sessionsByTrack[track.id] || []).filter(s => {
            const startMin = toMinutes(s.start_datetime)
            const endMin   = toMinutes(s.end_datetime)
            return startMin < GRID_END && endMin > GRID_START && endMin > startMin
          })
          const isPreview = dragPreview?.trackId === track.id

          return (
            <div
              key={track.id}
              className={`ag-track-col${isPreview ? ' ag-track-col--dragover' : ''}`}
              onDragOver={e => handleDragOver(e, track.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, track.id)}
              onClick={e => handleGridClick(e, track.id)}
            >
              {/* Hour lines */}
              {hours.map(m => (
                <div key={m} className="ag-hour-line" style={{ top: (m - GRID_START) * PX_PER_MIN }} />
              ))}

              {/* Half-hour lines */}
              {hours.slice(0, -1).map(m => (
                <div key={`h${m}`} className="ag-half-line" style={{ top: (m - GRID_START + 30) * PX_PER_MIN }} />
              ))}

              {/* Drag preview ghost */}
              {isPreview && dragRef.current && (() => {
                const s = dragRef.current.session
                const dur = toMinutes(s.end_datetime) - toMinutes(s.start_datetime)
                const top = (dragPreview.startMinutes - GRID_START) * PX_PER_MIN
                const height = Math.max(dur * PX_PER_MIN, MIN_CARD_H)
                return (
                  <div className="ag-session-ghost" style={{ top, height, borderColor: track.color || '#5B8AF5' }}>
                    <span className="ag-session-ghost-time">{minutesToHHMM(dragPreview.startMinutes)}</span>
                    <span className="ag-session-ghost-title">{s.title}</span>
                  </div>
                )
              })()}

              {/* Sessions */}
              {trackSessions.map(session => {
                const startMin = toMinutes(session.start_datetime)
                const endMin   = toMinutes(session.end_datetime)
                const top      = (startMin - GRID_START) * PX_PER_MIN
                const height   = Math.max((endMin - startMin) * PX_PER_MIN, MIN_CARD_H)
                const hasConflict = conflicts.has(session.id)
                const trackColor  = track.color || '#5B8AF5'
                const shortCard   = height < 55

                return (
                  <div
                    key={session.id}
                    className={`ag-session-card${hasConflict ? ' ag-session-card--conflict' : ''}`}
                    style={{ top, height, borderLeft: `3px solid ${trackColor}` }}
                    draggable
                    onDragStart={e => handleDragStart(e, session)}
                    onDragEnd={handleDragEnd}
                    onClick={e => { e.stopPropagation(); onEditSession(session) }}
                  >
                    <div className="ag-session-drag-handle"><IcoDrag /></div>
                    <div className="ag-session-body">
                      <div className="ag-session-time">
                        {formatDisplayTime(session.start_datetime)}–{formatDisplayTime(session.end_datetime)}
                        {!shortCard && <span className="ag-session-dur">{durationLabel(session.start_datetime, session.end_datetime)}</span>}
                      </div>
                      {!shortCard && <div className="ag-session-title">{session.title}</div>}
                      {shortCard  && <div className="ag-session-title ag-session-title--inline">{session.title}</div>}
                      {!shortCard && session.speaker_name && <div className="ag-session-speaker">◆ {session.speaker_name}</div>}
                      {!shortCard && session.location     && <div className="ag-session-loc">{session.location}</div>}
                    </div>
                    <div className="ag-session-actions">
                      <button className="ag-session-action-btn" onClick={e => { e.stopPropagation(); onEditSession(session) }} title="Edit session"><IcoEdit /></button>
                      <button className="ag-session-action-btn ag-session-action-btn--danger" onClick={e => { e.stopPropagation(); onDeleteSession(session) }} title="Delete session"><IcoTrash /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OrganizerAgenda() {
  const navigate = useNavigate()

  // event list state
  const [myEvents,       setMyEvents]       = useState([])
  const [selectedEvent,  setSelectedEvent]  = useState(null)
  const [loadingList,    setLoadingList]     = useState(true)
  const [listError,      setListError]      = useState('')
  const [dismissedIds,   setDismissedIds]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('agenda-dismissed-events') ?? '[]')) }
    catch { return new Set() }
  })

  // agenda state
  const [tracks,         setTracks]         = useState([])
  const [sessions,       setSessions]       = useState([])
  const [loadingAgenda,  setLoadingAgenda]  = useState(false)

  // modals
  const [trackModal,       setTrackModal]       = useState(null)  // null | { track: Track|null }
  const [sessionModal,     setSessionModal]     = useState(null)  // null | { session, trackId, time }
  const [pendingDismissId, setPendingDismissId] = useState(null)

  // flash
  const [flash, setFlash] = useState(null)
  const flashTimer = useRef(null)

  const showFlash = useCallback((msg, type = 'success') => {
    clearTimeout(flashTimer.current)
    setFlash({ msg, type })
    flashTimer.current = setTimeout(() => setFlash(null), 4000)
  }, [])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const handleDismiss = useCallback((id) => { setPendingDismissId(id) }, [])

  // load organizer's events
  useEffect(() => {
    let cancelled = false
    Promise.all([
      eventsApi.myEvents(),
      collaboratorApi.getMyCollaboratingEvents(),
    ])
      .then(([ownedRes, collabRes]) => {
        if (cancelled) return
        const owned = ownedRes.data ?? []
        const collab = collabRes.data ?? []
        const ownedIds = new Set(owned.map(e => e.id))
        const merged = [...owned, ...collab.filter(e => !ownedIds.has(e.id))]
        setMyEvents(merged)
        let dismissed
        try { dismissed = new Set(JSON.parse(localStorage.getItem('agenda-dismissed-events') ?? '[]')) } catch { dismissed = new Set() }
        const first = merged.find(e => !dismissed.has(e.id))
        if (first) loadAgenda(first)
      })
      .catch(() => setListError('Failed to load events.'))
      .finally(() => { if (!cancelled) setLoadingList(false) })
    return () => { cancelled = true }
  }, [])

  const loadAgenda = useCallback(async (event) => {
    setSelectedEvent(event)
    setTracks([])
    setSessions([])
    setLoadingAgenda(true)
    try {
      const [tracksRes, sessionsRes] = await Promise.all([
        agendaApi.listTracks(event.id),
        agendaApi.listSessions(event.id),
      ])
      setTracks(tracksRes.data ?? [])
      setSessions(sessionsRes.data ?? [])
    } catch {
      showFlash('Failed to load agenda.', 'error')
    } finally {
      setLoadingAgenda(false)
    }
  }, [showFlash])

  const confirmDismiss = useCallback(() => {
    if (!pendingDismissId) return
    const id = pendingDismissId
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('agenda-dismissed-events', JSON.stringify([...next])) } catch {}
      return next
    })
    setPendingDismissId(null)
    if (selectedEvent?.id === id) {
      const nextDismissed = new Set(dismissedIds)
      nextDismissed.add(id)
      const nextEv = myEvents.find(e => !nextDismissed.has(e.id))
      if (nextEv) loadAgenda(nextEv)
      else { setSelectedEvent(null); setTracks([]); setSessions([]) }
    }
  }, [pendingDismissId, selectedEvent, myEvents, dismissedIds, loadAgenda])

  useEffect(() => {
    if (!pendingDismissId) return
    const handler = (e) => { if (e.key === 'Escape') setPendingDismissId(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pendingDismissId])

  const refreshAgenda = useCallback(async () => {
    if (!selectedEvent) return
    try {
      const [tracksRes, sessionsRes] = await Promise.all([
        agendaApi.listTracks(selectedEvent.id),
        agendaApi.listSessions(selectedEvent.id),
      ])
      setTracks(tracksRes.data ?? [])
      setSessions(sessionsRes.data ?? [])
    } catch { /* silent */ }
  }, [selectedEvent])

  // ── Track CRUD ──────────────────────────────────────────────────────────────
  const handleSaveTrack = useCallback(async (form) => {
    const editing = trackModal?.track
    if (editing) {
      await agendaApi.updateTrack(editing.id, { name: form.name, color: form.color, description: form.description || null })
      showFlash('Track updated.')
    } else {
      await agendaApi.createTrack(selectedEvent.id, { name: form.name, color: form.color, description: form.description || null, order_index: tracks.length })
      showFlash('Track added.')
    }
    setTrackModal(null)
    await refreshAgenda()
  }, [trackModal, selectedEvent, tracks.length, refreshAgenda, showFlash])

  const handleDeleteTrack = useCallback(async (track) => {
    const trackSessions = sessions.filter(s => s.track_id === track.id)
    const msg = trackSessions.length > 0
      ? `Delete "${track.name}" and its ${trackSessions.length} session${trackSessions.length > 1 ? 's' : ''}? This cannot be undone.`
      : `Delete track "${track.name}"? This cannot be undone.`
    if (!window.confirm(msg)) return
    try {
      await agendaApi.deleteTrack(track.id)
      showFlash('Track deleted.')
      await refreshAgenda()
    } catch (e) {
      showFlash(e.response?.data?.detail ?? 'Could not delete track.', 'error')
    }
  }, [sessions, refreshAgenda, showFlash])

  // ── Session CRUD ────────────────────────────────────────────────────────────
  const handleAddSession = useCallback((trackId, time) => {
    setSessionModal({ session: null, trackId, time })
  }, [])

  const handleSaveSession = useCallback(async (form) => {
    const editing = sessionModal?.session
    if (editing) {
      await agendaApi.updateSession(editing.id, {
        title:                 form.title,
        start_datetime:        form.start_datetime,
        end_datetime:          form.end_datetime,
        speaker_name:          form.speaker_name,
        location:              form.location,
        description:           form.description,
        capacity:              form.capacity,
        requires_registration: form.requires_registration,
      })
      showFlash('Session updated.')
    } else {
      await agendaApi.createSession(form.track_id, {
        title:                 form.title,
        start_datetime:        form.start_datetime,
        end_datetime:          form.end_datetime,
        speaker_name:          form.speaker_name,
        location:              form.location,
        description:           form.description,
        capacity:              form.capacity,
        requires_registration: form.requires_registration,
        order_index:           sessions.filter(s => s.track_id === form.track_id).length,
      })
      showFlash('Session added.')
    }
    setSessionModal(null)
    await refreshAgenda()
  }, [sessionModal, sessions, refreshAgenda, showFlash])

  const handleDeleteSession = useCallback(async (session) => {
    if (!window.confirm(`Delete "${session.title}"?`)) return
    try {
      await agendaApi.deleteSession(session.id)
      showFlash('Session deleted.')
      await refreshAgenda()
    } catch (e) {
      showFlash(e.response?.data?.detail ?? 'Could not delete session.', 'error')
    }
  }, [refreshAgenda, showFlash])

  // ── Drag drop ───────────────────────────────────────────────────────────────
  const handleDrop = useCallback(async (session, newStart, newEnd, newTrackId) => {
    try {
      if (newTrackId && newTrackId !== session.track_id) {
        // Cross-track: backend has no track_id on update, so recreate in new track then delete original
        await agendaApi.createSession(newTrackId, {
          title:                 session.title,
          description:           session.description || null,
          speaker_name:          session.speaker_name || null,
          speaker_bio:           session.speaker_bio || null,
          start_datetime:        newStart,
          end_datetime:          newEnd,
          capacity:              session.capacity || null,
          requires_registration: session.requires_registration,
          location:              session.location || null,
          order_index:           0,
        })
        await agendaApi.deleteSession(session.id)
      } else {
        await agendaApi.updateSession(session.id, { start_datetime: newStart, end_datetime: newEnd })
      }
      await refreshAgenda()
    } catch (e) {
      showFlash(e.response?.data?.detail ?? 'Could not reschedule session.', 'error')
    }
  }, [refreshAgenda, showFlash])

  // ── Computed ─────────────────────────────────────────────────────────────────
  const conflicts     = useMemo(() => detectConflicts(sessions), [sessions])

  const orphanSessions = useMemo(() => {
    const trackMap = new Map(tracks.map(t => [t.id, t]))
    return sessions
      .filter(s => {
        const startMin = toMinutes(s.start_datetime)
        const endMin   = toMinutes(s.end_datetime)
        return startMin >= GRID_END || endMin <= GRID_START || endMin <= startMin
      })
      .map(s => {
        const t = trackMap.get(s.track_id)
        return { ...s, _trackName: t?.name ?? 'Unknown track', _trackColor: t?.color || '#5B8AF5' }
      })
  }, [tracks, sessions])
  const conflictList  = useMemo(() => {
    const pairs = []
    const seen  = new Set()
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i], b = sessions[j]
        if (a.track_id !== b.track_id) continue
        const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`
        if (seen.has(key)) continue
        const aS = new Date(a.start_datetime), aE = new Date(a.end_datetime)
        const bS = new Date(b.start_datetime), bE = new Date(b.end_datetime)
        if (aS < bE && aE > bS) { pairs.push({ a, b }); seen.add(key) }
      }
    }
    return pairs
  }, [sessions])

  const eventDate = selectedEvent?.start_datetime ? getISODate(selectedEvent.start_datetime) : null

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loadingList) return <div className="ed-state">Loading…</div>
  if (listError)   return (
    <div className="ed-state">
      <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>{listError}</p>
      <button className="ag-btn ag-btn--ghost" onClick={() => window.location.reload()}>Retry</button>
    </div>
  )

  return (
    <div className="me-layout">

      {/* ── Event list sidebar ── */}
      <aside className="me-event-list">
        <div className="me-event-list-head">
          <h2 className="me-event-list-heading">Your events</h2>
          <button className="me-new-btn" onClick={() => navigate('/organizer/create-event')} title="Create new event">
            <IcoPlus />
          </button>
        </div>
        {(() => {
          const visibleEvents = myEvents.filter(ev => !dismissedIds.has(ev.id))
          return visibleEvents.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center', lineHeight: 1.5 }}>
              No events yet.{' '}
              <button style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', font: 'inherit', fontSize: 13 }}
                onClick={() => navigate('/organizer/create-event')}>Create one</button>
            </p>
          ) : (
            <div className="me-event-list-items">
              {visibleEvents.map(ev => (
                <EventListItem key={ev.id} event={ev} selected={selectedEvent?.id === ev.id} onClick={() => loadAgenda(ev)} onDismiss={handleDismiss} />
              ))}
            </div>
          )
        })()}
      </aside>

      {/* ── Right panel ── */}
      <div className="me-detail-panel ag-detail-panel">

        {!selectedEvent ? (
          <div className="ed-state" style={{ height: '60vh' }}>Select an event to manage its agenda</div>
        ) : loadingAgenda ? (
          <div className="ed-state" style={{ height: '60vh' }}>Loading agenda…</div>
        ) : (
          <>
            {/* Page header */}
            <div className="ag-page-header">
              <div className="ag-page-header-left">
                <h1 className="ag-page-title">Agenda</h1>
                <p className="ag-page-sub">
                  {selectedEvent.title} · Drag sessions to reschedule. Click grid to add. Conflicts flagged automatically.
                </p>
              </div>
              <div className="ag-page-header-right">
                <a href={`/events/${selectedEvent.id}`} target="_blank" rel="noopener noreferrer" className="ag-btn ag-btn--ghost">
                  <IcoEye /> Preview
                </a>
                <button className="ag-btn ag-btn--ghost" onClick={() => setTrackModal({ track: null })}>
                  <IcoPlus /> Add track
                </button>
                <button
                  className="ag-btn ag-btn--primary"
                  onClick={() => setSessionModal({ session: null, trackId: tracks[0]?.id ?? null, time: null })}
                  disabled={tracks.length === 0}
                  title={tracks.length === 0 ? 'Add a track first' : undefined}
                >
                  <IcoPlus /> Add session
                </button>
              </div>
            </div>

            {/* Flash */}
            {flash && <div className={`ag-flash ag-flash--${flash.type}`} style={{ marginTop: 16 }}>{flash.msg}</div>}

            {/* Conflict banner */}
            {conflictList.length > 0 && (
              <div className="ag-conflict-banner">
                <IcoWarn />
                <div>
                  <strong>{conflictList.length} conflict{conflictList.length > 1 ? 's' : ''} detected</strong>
                  <ul className="ag-conflict-list">
                    {conflictList.map(({ a, b }, i) => (
                      <li key={i}>
                        &ldquo;{a.title}&rdquo; overlaps with &ldquo;{b.title}&rdquo; at {formatDisplayTime(b.start_datetime > a.start_datetime ? b.start_datetime : a.start_datetime)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Orphan sessions — invalid times, not renderable in grid */}
            {orphanSessions.length > 0 && (
              <div className="ag-orphan-banner">
                <IcoWarn />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>
                    {orphanSessions.length} session{orphanSessions.length > 1 ? 's' : ''} with invalid times
                  </strong>
                  <ul className="ag-conflict-list">
                    {orphanSessions.map(s => (
                      <li key={s.id}>
                        <span style={{ borderLeft: `3px solid ${s._trackColor}`, paddingLeft: 6 }}>
                          &ldquo;{s.title}&rdquo; in {s._trackName} — {formatDisplayTime(s.start_datetime)}–{formatDisplayTime(s.end_datetime)}
                        </span>
                        <button
                          className="ag-session-action-btn ag-session-action-btn--danger"
                          onClick={() => handleDeleteSession(s)}
                          title="Delete session"
                          style={{ flexShrink: 0 }}
                        ><IcoTrash /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Track management strip */}
            {tracks.length > 0 && (
              <div className="ag-tracks-strip">
                <span className="ag-tracks-label">Tracks:</span>
                {tracks.map(track => (
                  <div key={track.id} className="ag-track-chip">
                    <span className="ag-track-chip-dot" style={{ background: track.color || '#5B8AF5' }} />
                    <span className="ag-track-chip-name">{track.name}</span>
                    <button className="ag-track-chip-btn" onClick={() => setTrackModal({ track })} title="Edit track"><IcoEdit /></button>
                    <button className="ag-track-chip-btn ag-track-chip-btn--danger" onClick={() => handleDeleteTrack(track)} title="Delete track"><IcoTrash /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Time grid */}
            <AgendaGrid
              tracks={tracks}
              sessions={sessions}
              eventDate={eventDate}
              conflicts={conflicts}
              onEditSession={s => setSessionModal({ session: s, trackId: s.track_id, time: null })}
              onDeleteSession={handleDeleteSession}
              onAddSession={handleAddSession}
              onDrop={handleDrop}
            />
          </>
        )}
      </div>

      {/* ── Track modal ── */}
      {trackModal && (
        <TrackModal track={trackModal.track} onSave={handleSaveTrack} onClose={() => setTrackModal(null)} />
      )}

      {/* ── Session modal ── */}
      {sessionModal && (
        <SessionModal
          session={sessionModal.session}
          tracks={tracks}
          eventDate={eventDate}
          defaultTrackId={sessionModal.trackId}
          defaultTime={sessionModal.time}
          onSave={handleSaveSession}
          onClose={() => setSessionModal(null)}
        />
      )}

      {/* ── Dismiss confirm ── */}
      {pendingDismissId && (
        <div className="ag-modal-backdrop" onClick={e => e.target === e.currentTarget && setPendingDismissId(null)}>
          <div className="ag-modal" style={{ maxWidth: 380 }}>
            <div className="ag-modal-head">
              <h2 className="ag-modal-title">Remove from list?</h2>
              <button className="ag-modal-close" onClick={() => setPendingDismissId(null)}><IcoX /></button>
            </div>
            <div className="ag-modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                This cancelled event will be hidden from your sidebar. It won't be deleted — you can still find it in Manage Events.
              </p>
            </div>
            <div className="ag-modal-foot">
              <button className="ag-btn ag-btn--ghost" onClick={() => setPendingDismissId(null)}>Cancel</button>
              <button className="ag-btn" style={{ background: '#f87171', color: '#fff', borderColor: '#f87171' }} onClick={confirmDismiss}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
