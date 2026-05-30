import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../services/api'

const STATUS_FILTERS = [
  { value: 'all',       label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft',     label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'closed',    label: 'Closed' },
]

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso) {
  if (!iso) return '—'
  const parts = iso.slice(0, 10).split('-')
  if (parts.length < 3) return '—'
  const [year, month, day] = parts
  return `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`
}

function normalizeError(err, fallback) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return fallback
}

function ownerLabel(usersMap, ev) {
  const u = usersMap.get(ev.owner_id)
  if (u) return `${u.first_name} ${u.last_name}`
  return ev.owner_email ?? `#${ev.owner_id}`
}

function ownerSub(usersMap, ev) {
  const u = usersMap.get(ev.owner_id)
  return u?.email ?? ev.owner_email ?? null
}

const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="4.6" />
    <path d="M9.5 9.5 13 13" strokeLinecap="round" />
  </svg>
)

const IcoGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="7" cy="7" r="5.5" />
    <path d="M7 1.5C5.5 3.5 5 5.2 5 7s.5 3.5 2 5.5" strokeLinecap="round" />
    <path d="M7 1.5C8.5 3.5 9 5.2 9 7s-.5 3.5-2 5.5" strokeLinecap="round" />
    <path d="M1.5 7h11" strokeLinecap="round" />
  </svg>
)

const IcoCheck = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 7.5l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IcoPencil = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M9 2l3 3-7 7H2v-3l7-7Z" strokeLinejoin="round" />
    <path d="M9 2l3 3" />
  </svg>
)

const IcoX = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3l8 8M11 3l-8 8" strokeLinecap="round" />
  </svg>
)

function AdminStat({ label, value, sub, icon }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-top">
        <span className="adm-stat-label">{label}</span>
        <span className="adm-stat-icon">{icon}</span>
      </div>
      <span className="adm-stat-value">{value}</span>
      <span className="adm-stat-sub">{sub}</span>
    </div>
  )
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

export default function AdminEvents() {
  const [allEvents, setAllEvents]       = useState([])
  const [usersMap, setUsersMap]         = useState(new Map())
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(false)
  const [notice, setNotice]             = useState('')
  const [busyId, setBusyId]             = useState(null)
  const noticeTimer                     = useRef(null)

  useEffect(() => {
    Promise.all([
      adminApi.listEvents().then(r => Array.isArray(r.data) ? r.data : []),
      adminApi.listUsers().then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    ])
      .then(([events, users]) => {
        setAllEvents(events)
        const map = new Map()
        users.forEach(u => map.set(u.id, u))
        setUsersMap(map)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const showNotice = (msg) => {
    clearTimeout(noticeTimer.current)
    setNotice(msg)
    noticeTimer.current = setTimeout(() => setNotice(''), 5000)
  }

  const filtered = useMemo(() => {
    let list = allEvents
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(ev => {
        const u = usersMap.get(ev.owner_id)
        const ownerStr = u
          ? `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase()
          : (ev.owner_email ?? '').toLowerCase()
        return (
          ev.title?.toLowerCase().includes(q) ||
          ownerStr.includes(q) ||
          String(ev.owner_id).includes(q)
        )
      })
    }
    return [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  }, [allEvents, statusFilter, search, usersMap])

  const stats = useMemo(() => ({
    total:     allEvents.length,
    published: allEvents.filter(e => e.status === 'published').length,
    draft:     allEvents.filter(e => e.status === 'draft').length,
    inactive:  allEvents.filter(e => e.status === 'cancelled' || e.status === 'closed').length,
  }), [allEvents])

  const unpublish = async (ev) => {
    setBusyId(ev.id)
    try {
      const r = await adminApi.unpublishEvent(ev.id)
      setAllEvents(list => list.map(e => e.id === ev.id ? { ...e, ...r.data } : e))
      showNotice(`"${ev.title}" was unpublished.`)
    } catch (err) {
      showNotice(normalizeError(err, 'Failed to unpublish event.'))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"? This cannot be undone.`)) return
    setBusyId(ev.id)
    try {
      await adminApi.deleteEvent(ev.id)
      setAllEvents(list => list.filter(e => e.id !== ev.id))
      showNotice(`"${ev.title}" was deleted.`)
    } catch (err) {
      showNotice(normalizeError(err, 'Failed to delete event.'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="ed-state">Loading...</div>
  if (error) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load events.</p>
    </div>
  )

  return (
    <div className="adm-wrap">
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Events</h1>
          <p className="adm-sub">Review and moderate all platform events.</p>
        </div>
      </div>

      <div className="adm-stat-grid">
        <AdminStat
          label="TOTAL EVENTS"
          value={stats.total.toLocaleString()}
          sub="All platform events"
          icon={<IcoGlobe />}
        />
        <AdminStat
          label="PUBLISHED"
          value={stats.published.toLocaleString()}
          sub="Live and visible to attendees"
          icon={<IcoCheck />}
        />
        <AdminStat
          label="DRAFT"
          value={stats.draft.toLocaleString()}
          sub="Awaiting publication"
          icon={<IcoPencil />}
        />
        <AdminStat
          label="CANCELLED / CLOSED"
          value={stats.inactive.toLocaleString()}
          sub="No longer accepting registrations"
          icon={<IcoX />}
        />
      </div>

      <section className="adm-users-panel">
        <div className="adm-users-toolbar">
          <label className="adm-users-search">
            <IcoSearch />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, organizer name or email"
              aria-label="Search events"
            />
          </label>
          <div className="adm-users-segments" aria-label="Filter events by status">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                className={statusFilter === f.value ? 'active' : ''}
                onClick={() => setStatusFilter(f.value)}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {notice && <p className="adm-users-notice">{notice}</p>}

        <div className="adm-users-table-wrap">
          <table className="adm-users-table adm-events-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Organizer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Registrations</th>
                <th>Revenue</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(ev => {
                const name = ownerLabel(usersMap, ev)
                const email = ownerSub(usersMap, ev)
                return (
                  <tr key={ev.id}>
                    <td>
                      <div className="adm-event-identity">
                        <span className="adm-event-title">{ev.title}</span>
                        <span className="adm-event-meta">
                          {ev.location_type ?? '—'}
                          {' · '}
                          {ev.is_free ? 'Free' : 'Paid'}
                          {' · '}
                          #{ev.id}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="adm-event-identity">
                        <span className="adm-event-title" style={{ fontWeight: 400, fontSize: 13 }}>{name}</span>
                        {email && <span className="adm-event-meta">{email}</span>}
                      </div>
                    </td>
                    <td className="adm-event-date">{fmtDate(ev.start_datetime)}</td>
                    <td><StatusPill status={ev.status} /></td>
                    <td className="adm-event-dim">
                      {ev.total_registrations != null ? ev.total_registrations.toLocaleString() : '—'}
                    </td>
                    <td className="adm-event-dim">
                      {ev.total_revenue != null
                        ? `$${parseFloat(ev.total_revenue).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                        : '—'}
                    </td>
                    <td>
                      <div className="adm-user-actions">
                        <Link
                          className="adm-user-action"
                          to={`/admin/events/${ev.id}`}
                        >
                          View
                        </Link>
                        {ev.status === 'published' && (
                          <button
                            className="adm-user-action"
                            onClick={() => unpublish(ev)}
                            disabled={!!busyId}
                            type="button"
                          >
                            {busyId === ev.id ? '…' : 'Unpublish'}
                          </button>
                        )}
                        <button
                          className="adm-user-action adm-user-action--danger"
                          onClick={() => remove(ev)}
                          disabled={!!busyId}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="adm-users-empty">
              <p>No events found.</p>
              <span>Try a different filter or search term.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
