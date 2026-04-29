import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { registrationsApi, eventsApi, ticketTiersApi, categoriesApi } from '../services/api'

// ── icons ──────────────────────────────────────────────────────────────────

const IcoEye = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M1 7.5C1 7.5 3.5 3 7.5 3s6.5 4.5 6.5 4.5S11.5 12 7.5 12 1 7.5 1 7.5Z" strokeLinejoin="round" />
    <circle cx="7.5" cy="7.5" r="1.8" />
  </svg>
)
const IcoTickets = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="4" width="13" height="7" rx="1.2" />
    <line x1="5" y1="4" x2="5" y2="11" strokeDasharray="1.5 1.5" />
    <line x1="10" y1="4" x2="10" y2="11" strokeDasharray="1.5 1.5" />
  </svg>
)
const IcoX = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="2.5" y1="2.5" x2="10.5" y2="10.5" strokeLinecap="round" />
    <line x1="10.5" y1="2.5" x2="2.5" y2="10.5" strokeLinecap="round" />
  </svg>
)
const IcoArrow = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="2" y1="6" x2="10" y2="6" strokeLinecap="round" />
    <path d="M7 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IcoEmpty = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="4" y="8" width="32" height="26" rx="3" />
    <line x1="4" y1="15" x2="36" y2="15" />
    <line x1="12" y1="4" x2="12" y2="12" strokeLinecap="round" />
    <line x1="28" y1="4" x2="28" y2="12" strokeLinecap="round" />
    <line x1="12" y1="23" x2="28" y2="23" strokeLinecap="round" />
    <line x1="12" y1="29" x2="22" y2="29" strokeLinecap="round" />
  </svg>
)

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_TABS = ['All', 'Confirmed', 'Pending', 'Cancelled']

const STATUS_DOT = {
  confirmed: 'myreg-dot--green',
  pending:   'myreg-dot--amber',
  cancelled: 'myreg-dot--red',
  rejected:  'myreg-dot--red',
}

const STATUS_LABEL = {
  confirmed: 'confirmed',
  pending:   'pending',
  cancelled: 'cancelled',
  rejected:  'rejected',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getLocation(event) {
  if (!event) return null
  if (event.location_type === 'online') return 'Remote'
  return event.physical_address || null
}

function getCategoryLabel(event, categoryMap) {
  if (!event) return '···'
  const firstId = event.category_ids?.[0]
  const name = firstId ? categoryMap[firstId] : null
  return name ? name.toUpperCase() : '···'
}

// ── confirmation row ───────────────────────────────────────────────────────

function ConfirmRow({ colSpan, eventTitle, onConfirm, onCancel, loading, error }) {
  return (
    <tr className="myreg-confirm-tr">
      <td colSpan={colSpan}>
        <div className="myreg-confirm-inner">
          <p className="myreg-confirm-text">
            Cancel registration for <strong>{eventTitle ?? 'this event'}</strong>? This cannot be undone.
          </p>
          {error && <span className="myreg-confirm-err">{error}</span>}
          <div className="myreg-confirm-btns">
            <button className="myreg-confirm-yes" onClick={onConfirm} disabled={loading}>
              {loading ? 'Cancelling…' : 'Yes, cancel'}
            </button>
            <button className="myreg-confirm-no" onClick={onCancel} disabled={loading}>
              Keep it
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── main component ─────────────────────────────────────────────────────────

export default function MyRegistrations() {
  const navigate = useNavigate()
  const [registrations, setRegistrations] = useState([])
  const [eventMap, setEventMap]           = useState({})
  const [tierMap, setTierMap]             = useState({})
  const [categoryMap, setCategoryMap]     = useState({}) // categoryId → name
  const [loading, setLoading]             = useState(true)
  const [fetchError, setFetchError]       = useState('')
  const [activeTab, setActiveTab]         = useState('All')
  const [confirmId, setConfirmId]         = useState(null)
  const [cancelling, setCancelling]       = useState(false)
  const [cancelError, setCancelError]     = useState('')

  useEffect(() => {
    let cancelled = false

    registrationsApi.getMine()
      .then(res => {
        if (cancelled) return
        const regs = res.data
        setRegistrations(regs)

        const uniqueEventIds = [...new Set(regs.map(r => r.event_id))]
        if (uniqueEventIds.length === 0) return null

        return Promise.all([
          Promise.allSettled(
            uniqueEventIds.map(id =>
              eventsApi.getById(id).then(r => ({ id, data: r.data }))
            )
          ),
          Promise.allSettled(
            uniqueEventIds.map(id =>
              ticketTiersApi.listByEvent(id).then(r => r.data)
            )
          ),
          categoriesApi.list().then(r => r.data).catch(() => []),
        ])
      })
      .then(results => {
        if (!results || cancelled) return
        const [eventResults, tierResults, categories] = results

        const eMap = {}
        eventResults.forEach(r => {
          if (r.status === 'fulfilled') eMap[r.value.id] = r.value.data
        })
        setEventMap(eMap)

        const tMap = {}
        tierResults.forEach(r => {
          if (r.status === 'fulfilled') {
            r.value.forEach(t => { tMap[t.id] = t })
          }
        })
        setTierMap(tMap)

        const cMap = {}
        if (Array.isArray(categories)) {
          categories.forEach(c => { cMap[c.id] = c.name })
        }
        setCategoryMap(cMap)
      })
      .catch(() => {
        if (!cancelled) setFetchError('Failed to load registrations. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const handleCancelConfirm = async () => {
    setCancelling(true)
    setCancelError('')
    try {
      await registrationsApi.cancel(confirmId, null)
      setRegistrations(prev =>
        prev.map(r =>
          r.id === confirmId
            ? { ...r, status: 'cancelled', cancelled_at: new Date().toISOString() }
            : r
        )
      )
      setConfirmId(null)
    } catch (err) {
      const msg = err.response?.data?.detail
      setCancelError(typeof msg === 'string' ? msg : 'Failed to cancel. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  const filtered = useMemo(() => {
    if (activeTab === 'All') return registrations
    if (activeTab === 'Cancelled')
      return registrations.filter(r => r.status === 'cancelled' || r.status === 'rejected')
    return registrations.filter(r => r.status === activeTab.toLowerCase())
  }, [registrations, activeTab])

  const counts = useMemo(() => ({
    All:       registrations.length,
    Confirmed: registrations.filter(r => r.status === 'confirmed').length,
    Pending:   registrations.filter(r => r.status === 'pending').length,
    Cancelled: registrations.filter(r => r.status === 'cancelled' || r.status === 'rejected').length,
  }), [registrations])

  // ── loading ──
  if (loading) return <div className="ed-state">Loading…</div>

  // ── fetch error ──
  if (fetchError) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-msg">{fetchError}</p>
      <button
        className="reg-btn-secondary"
        style={{ marginTop: 16, maxWidth: 200 }}
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  )

  return (
    <div className="myreg-wrap">

      {/* header */}
      <div className="myreg-header">
        <div>
          <h1 className="myreg-heading">My registrations</h1>
          <p className="myreg-sub">Manage every event you've signed up for.</p>
        </div>
        <button className="myreg-discover-btn" onClick={() => navigate('/events')}>
          Discover events <IcoArrow />
        </button>
      </div>

      {/* tabs */}
      {registrations.length > 0 && (
        <div className="myreg-tabs" role="tablist">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`myreg-tab${activeTab === tab ? ' myreg-tab--active' : ''}`}
              onClick={() => { setActiveTab(tab); setConfirmId(null); setCancelError('') }}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>
      )}

      {/* empty — no registrations at all */}
      {registrations.length === 0 && (
        <div className="myreg-empty">
          <span className="myreg-empty-icon"><IcoEmpty /></span>
          <p className="myreg-empty-title">No registrations yet</p>
          <p className="myreg-empty-sub">Browse upcoming events and register to see them here.</p>
          <button
            className="reg-btn-primary"
            style={{ maxWidth: 200, marginTop: 8 }}
            onClick={() => navigate('/events')}
          >
            Browse events
          </button>
        </div>
      )}

      {/* empty — tab filter */}
      {registrations.length > 0 && filtered.length === 0 && (
        <div className="myreg-empty">
          <p className="myreg-empty-title">No {activeTab.toLowerCase()} registrations</p>
          <button
            className="myreg-tab myreg-tab--active"
            style={{ marginTop: 12 }}
            onClick={() => setActiveTab('All')}
          >
            View all
          </button>
        </div>
      )}

      {/* table */}
      {filtered.length > 0 && (
        <div className="myreg-table-wrap">
          <table className="myreg-table">
            <thead>
              <tr>
                <th>EVENT</th>
                <th>DATE</th>
                <th>TIER</th>
                <th>STATUS</th>
                <th>PURCHASED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(reg => {
                const event    = eventMap[reg.event_id] ?? null
                const tier     = tierMap[reg.ticket_tier_id] ?? null
                const tierName = tier?.name ?? (reg.ticket_tier_id ? `Tier #${reg.ticket_tier_id}` : 'General')
                const canCancel = reg.status === 'confirmed' || reg.status === 'pending'
                const location = getLocation(event)
                const isConfirming = confirmId === reg.id

                return (
                  <>
                    <tr
                      key={reg.id}
                      className={`myreg-row${reg.status === 'cancelled' || reg.status === 'rejected' ? ' myreg-row--dim' : ''}${isConfirming ? ' myreg-row--confirming' : ''}`}
                    >
                      {/* event cell */}
                      <td className="myreg-td-event">
                        <div className="myreg-event-cell">
                          <div className="myreg-cat-thumb" aria-hidden="true">
                            <span>{getCategoryLabel(event, categoryMap)}</span>
                          </div>
                          <div className="myreg-event-info">
                            <p className="myreg-event-name">{event?.title ?? `Event #${reg.event_id}`}</p>
                            {location && <p className="myreg-event-loc">{location}</p>}
                          </div>
                        </div>
                      </td>

                      {/* date */}
                      <td className="myreg-td-date">
                        {event?.start_datetime ? formatDate(event.start_datetime) : '—'}
                      </td>

                      {/* tier */}
                      <td className="myreg-td-tier">
                        <span className="myreg-tier-pill">{tierName}</span>
                      </td>

                      {/* status */}
                      <td className="myreg-td-status">
                        <span className="myreg-status-cell">
                          <span className={`myreg-dot ${STATUS_DOT[reg.status] ?? 'myreg-dot--muted'}`} />
                          {STATUS_LABEL[reg.status] ?? reg.status}
                        </span>
                      </td>

                      {/* purchased */}
                      <td className="myreg-td-purchased">
                        {formatDate(reg.registered_at)}
                      </td>

                      {/* actions */}
                      <td className="myreg-td-actions">
                        <div className="myreg-action-btns">
                          <button
                            className="myreg-action-btn"
                            title="View tickets"
                            onClick={() => navigate('/tickets')}
                          >
                            <IcoTickets />
                          </button>
                          <button
                            className="myreg-action-btn"
                            title="View event"
                            onClick={() => navigate(`/events/${reg.event_id}`)}
                          >
                            <IcoEye />
                          </button>
                          <button
                            className={`myreg-action-btn myreg-action-btn--cancel${!canCancel ? ' myreg-action-btn--disabled' : ''}`}
                            title={canCancel ? 'Cancel registration' : 'Cannot cancel'}
                            disabled={!canCancel}
                            onClick={() => {
                              if (!canCancel) return
                              if (isConfirming) { setConfirmId(null); setCancelError('') }
                              else { setConfirmId(reg.id); setCancelError('') }
                            }}
                          >
                            <IcoX />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* inline cancel confirmation row */}
                    {isConfirming && (
                      <ConfirmRow
                        key={`confirm-${reg.id}`}
                        colSpan={6}
                        eventTitle={event?.title}
                        loading={cancelling}
                        error={cancelError}
                        onConfirm={handleCancelConfirm}
                        onCancel={() => { setConfirmId(null); setCancelError('') }}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
