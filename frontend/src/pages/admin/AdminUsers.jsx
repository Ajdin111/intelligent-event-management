import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import NotFound from '../NotFound'

const ROLE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'attendee', label: 'Attendees' },
  { value: 'organizer', label: 'Organizers' },
  { value: 'admin', label: 'Admins' },
]

function roleLabel(user) {
  if (user?.role) return user.role
  if (user?.is_admin) return 'Admin'
  if (user?.is_organizer) return 'Organizer'
  return 'Attendee'
}

function initials(user) {
  const value = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase()
  return value || '?'
}

function formatDate(iso) {
  if (!iso) return 'Unknown'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function normalizeError(error, fallback) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return fallback
}

function userSort(a, b) {
  return (b.created_at ?? '').localeCompare(a.created_at ?? '')
}

function csvCell(value) {
  const clean = value == null ? '' : String(value)
  return `"${clean.replace(/"/g, '""')}"`
}

function exportUsersCSV(users, eventCountByOwner) {
  const now = new Date().toISOString().slice(0, 10)
  const rows = [
    ['ID', 'First Name', 'Last Name', 'Email', 'Role', 'Active', 'Owned Events', 'Joined'],
    ...users.map(user => [
      user.id,
      csvCell(user.first_name),
      csvCell(user.last_name),
      csvCell(user.email),
      csvCell(roleLabel(user)),
      user.is_active ? 'Yes' : 'No',
      eventCountByOwner.get(user.id) ?? 0,
      user.created_at?.slice(0, 10) ?? '',
    ]),
  ]

  const blob = new Blob([rows.map(row => row.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `teqevent-users-${now}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const IcoSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="4.6" />
    <path d="M9.5 9.5 13 13" strokeLinecap="round" />
  </svg>
)

const IcoUsers = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="5" cy="4" r="2.5" />
    <path d="M0.5 13c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" strokeLinecap="round" />
    <circle cx="10.5" cy="4.5" r="2" />
    <path d="M12.5 13c0-1.6-.9-3-2.2-3.8" strokeLinecap="round" />
  </svg>
)

const IcoShield = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M7 1.2 12 3v3.6c0 3-2 5.1-5 6.2-3-1.1-5-3.2-5-6.2V3l5-1.8Z" strokeLinejoin="round" />
    <path d="m4.8 7 1.4 1.4 3-3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IcoCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x=".5" y="1.5" width="13" height="12" rx="1.5" />
    <path d="M.5 5.5h13M4 1v2.5M10 1v2.5" strokeLinecap="round" />
  </svg>
)

const IcoEvent = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M2 2.5h10v9H2z" strokeLinejoin="round" />
    <path d="M4 5h6M4 7.5h6M4 10h3" strokeLinecap="round" />
  </svg>
)

const IcoDownload = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 10v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
  </svg>
)

const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M7 2v10M2 7h10" strokeLinecap="round" />
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

function StatusPill({ active }) {
  return (
    <span className={`adm-user-pill${active ? ' adm-user-pill--active' : ' adm-user-pill--inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RolePill({ user }) {
  const role = roleLabel(user).toLowerCase()
  return <span className={`adm-user-role adm-user-role--${role}`}>{roleLabel(user)}</span>
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [allUsers, setAllUsers] = useState([])
  const [users, setUsers] = useState([])
  const [events, setEvents] = useState([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    Promise.all([
      adminApi.listUsers().then(r => r.data),
      adminApi.listEvents().then(r => r.data).catch(() => []),
    ])
      .then(([usersData, eventsData]) => {
        const cleanUsers = Array.isArray(usersData) ? [...usersData].sort(userSort) : []
        setAllUsers(cleanUsers)
        setUsers(cleanUsers)
        setEvents(Array.isArray(eventsData) ? eventsData : [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || error) return undefined
    const timer = window.setTimeout(() => {
      const params = {}
      const query = search.trim()
      if (query) params.search = query
      if (role !== 'all') params.role = role

      setTableLoading(true)
      adminApi.listUsers(params)
        .then(r => setUsers(Array.isArray(r.data) ? [...r.data].sort(userSort) : []))
        .catch(err => {
          setUsers([])
          setNotice(normalizeError(err, 'Unable to filter users.'))
        })
        .finally(() => setTableLoading(false))
    }, 250)

    return () => window.clearTimeout(timer)
  }, [search, role, loading, error])

  const eventCountByOwner = useMemo(() => {
    const counts = new Map()
    events.forEach(event => counts.set(event.owner_id, (counts.get(event.owner_id) ?? 0) + 1))
    return counts
  }, [events])

  const stats = useMemo(() => {
    const source = allUsers
    const active = source.filter(u => u.is_active).length
    const organizers = source.filter(u => u.is_organizer).length
    const admins = source.filter(u => u.is_admin).length
    return { active, organizers, admins, total: source.length }
  }, [allUsers])

  const replaceUser = (updated) => {
    setUsers(list => list.map(u => u.id === updated.id ? updated : u).sort(userSort))
    setAllUsers(list => list.map(u => u.id === updated.id ? updated : u).sort(userSort))
  }

  const toggleActive = async (target) => {
    setNotice('')
    if (target.id === currentUser?.id && target.is_active) {
      setNotice('You cannot deactivate your own account.')
      return
    }

    setBusyId(target.id)
    try {
      const response = target.is_active
        ? await adminApi.deactivateUser(target.id)
        : await adminApi.activateUser(target.id)
      replaceUser(response.data)
      setNotice(`${target.email} is now ${response.data.is_active ? 'active' : 'inactive'}.`)
    } catch (err) {
      setNotice(normalizeError(err, 'Unable to update this user.'))
    } finally {
      setBusyId(null)
    }
  }

  const deleteUser = async (target) => {
    setNotice('')
    if (target.id === currentUser?.id) {
      setNotice('You cannot delete your own account.')
      return
    }
    if (!window.confirm(`Delete ${target.email}? This only succeeds when the user has no events or registrations.`)) return

    setBusyId(target.id)
    try {
      await adminApi.deleteUser(target.id)
      setUsers(list => list.filter(u => u.id !== target.id))
      setAllUsers(list => list.filter(u => u.id !== target.id))
      setNotice(`${target.email} was removed.`)
    } catch (err) {
      setNotice(normalizeError(err, 'Unable to delete this user.'))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="ed-state">Loading...</div>
  if (error) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load users.</p>
    </div>
  )

  return (
    <div className="adm-wrap">
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Users</h1>
          <p className="adm-sub">Manage real attendee, organizer, and admin accounts.</p>
        </div>
        <div className="adm-header-actions">
          <button
            className="adm-btn-primary"
            onClick={() => {}}
            type="button"
          >
            <IcoPlus />
            Invite User
          </button>
          <button
            className="adm-btn-secondary"
            onClick={() => exportUsersCSV(users, eventCountByOwner)}
            disabled={tableLoading || users.length === 0}
            type="button"
          >
            <IcoDownload />
            Export CSV
          </button>
        </div>
      </div>

      <div className="adm-stat-grid adm-user-stats">
        <AdminStat label="TOTAL USERS" value={stats.total.toLocaleString()} sub={`${stats.active} active accounts`} icon={<IcoUsers />} />
        <AdminStat label="ORGANIZERS" value={stats.organizers.toLocaleString()} sub="Can create and manage events" icon={<IcoEvent />} />
        <AdminStat label="ADMINS" value={stats.admins.toLocaleString()} sub="Protected admin access" icon={<IcoShield />} />
        <AdminStat label="EVENT OWNERS" value={eventCountByOwner.size.toLocaleString()} sub="Users with owned events" icon={<IcoCalendar />} />
      </div>

      <section className="adm-users-panel">
        <div className="adm-users-toolbar">
          <label className="adm-users-search">
            <IcoSearch />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              aria-label="Search users"
            />
          </label>

          <div className="adm-users-segments" aria-label="Filter users by role">
            {ROLE_FILTERS.map(item => (
              <button
                key={item.value}
                className={role === item.value ? 'active' : ''}
                onClick={() => setRole(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {notice && <p className="adm-users-notice">{notice}</p>}

        <div className="adm-users-table-wrap" aria-busy={tableLoading}>
          <table className="adm-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Owned events</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map(item => (
                <tr key={item.id}>
                  <td>
                    <button className="adm-user-identity" onClick={() => navigate(`/admin/users/${item.id}`)} type="button">
                      <span className="adm-user-avatar">{initials(item)}</span>
                      <span className="adm-user-copy">
                        <span>{item.first_name} {item.last_name}</span>
                        <small>{item.email}</small>
                      </span>
                    </button>
                  </td>
                  <td><RolePill user={item} /></td>
                  <td><StatusPill active={item.is_active} /></td>
                  <td>{eventCountByOwner.get(item.id) ?? 0}</td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>
                    <div className="adm-user-actions">
                      <Link className="adm-user-action" to={`/admin/users/${item.id}`}>View</Link>
                      <button
                        className="adm-user-action"
                        onClick={() => toggleActive(item)}
                        disabled={busyId === item.id}
                        type="button"
                      >
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="adm-user-action adm-user-action--danger"
                        onClick={() => deleteUser(item)}
                        disabled={busyId === item.id}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tableLoading && <div className="adm-users-loading">Updating...</div>}
          {!tableLoading && users.length === 0 && (
            <div className="adm-users-empty">
              <p>No users found.</p>
              <span>Try a different search or role filter.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export function AdminUserDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const numericId = Number(userId)
  const invalidId = !userId || !Number.isInteger(numericId) || numericId <= 0

  useEffect(() => {
    if (invalidId) {
      setNotFound(true)
      setLoading(false)
      return
    }

    Promise.all([
      adminApi.getUser(numericId).then(r => r.data),
      adminApi.listEvents().then(r => r.data).catch(() => []),
    ])
      .then(([userData, eventsData]) => {
        setUser(userData)
        setEvents(Array.isArray(eventsData) ? eventsData : [])
      })
      .catch(err => {
        if (err?.response?.status === 404) setNotFound(true)
        else setError(true)
      })
      .finally(() => setLoading(false))
  }, [numericId, invalidId])

  const ownedEvents = useMemo(
    () => events.filter(event => event.owner_id === user?.id).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [events, user?.id]
  )

  const toggleActive = async () => {
    setNotice('')
    if (user.id === currentUser?.id && user.is_active) {
      setNotice('You cannot deactivate your own account.')
      return
    }

    setBusy(true)
    try {
      const response = user.is_active
        ? await adminApi.deactivateUser(user.id)
        : await adminApi.activateUser(user.id)
      setUser(response.data)
      setNotice(`${user.email} is now ${response.data.is_active ? 'active' : 'inactive'}.`)
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true)
      else setNotice(normalizeError(err, 'Unable to update this user.'))
    } finally {
      setBusy(false)
    }
  }

  const deleteUser = async () => {
    setNotice('')
    if (user.id === currentUser?.id) {
      setNotice('You cannot delete your own account.')
      return
    }
    if (!window.confirm(`Delete ${user.email}? This only succeeds when the user has no events or registrations.`)) return

    setBusy(true)
    try {
      await adminApi.deleteUser(user.id)
      navigate('/admin/users', { replace: true })
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true)
      else setNotice(normalizeError(err, 'Unable to delete this user.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="ed-state">Loading...</div>
  if (notFound) return <NotFound />
  if (error) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load user.</p>
    </div>
  )

  return (
    <div className="adm-wrap">
      <div className="adm-header">
        <div>
          <button className="adm-users-back" onClick={() => navigate('/admin/users')} type="button">
            Back to users
          </button>
          <h1 className="adm-title">{user.first_name} {user.last_name}</h1>
          <p className="adm-sub">{user.email}</p>
        </div>
        <div className="adm-header-actions">
          <button className="adm-btn-secondary" onClick={toggleActive} disabled={busy} type="button">
            {user.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button className="adm-btn-secondary adm-btn-danger" onClick={deleteUser} disabled={busy} type="button">
            Delete
          </button>
        </div>
      </div>

      {notice && <p className="adm-users-notice">{notice}</p>}

      <div className="adm-user-detail-grid">
        <section className="adm-user-profile">
          <div className="adm-user-profile-head">
            <span className="adm-user-profile-avatar">{initials(user)}</span>
            <div>
              <RolePill user={user} />
              <StatusPill active={user.is_active} />
            </div>
          </div>

          <dl className="adm-user-facts">
            <div>
              <dt>User ID</dt>
              <dd>#{user.id}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </div>
            <div>
              <dt>Admin access</dt>
              <dd>{user.is_admin ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt>Organizer access</dt>
              <dd>{user.is_organizer ? 'Enabled' : 'Disabled'}</dd>
            </div>
          </dl>
        </section>

        <section className="adm-users-panel adm-user-events">
          <div className="adm-user-events-head">
            <div>
              <p className="adm-act-heading">Owned events</p>
              <span>{ownedEvents.length} real event{ownedEvents.length === 1 ? '' : 's'} in the database</span>
            </div>
          </div>

          {ownedEvents.length === 0 ? (
            <div className="adm-users-empty adm-users-empty--inline">
              <p>No owned events.</p>
              <span>This user has not created any events.</span>
            </div>
          ) : (
            <ul className="adm-user-event-list">
              {ownedEvents.map(event => (
                <li key={event.id}>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{formatDate(event.start_datetime)}</span>
                  </div>
                  <span className="adm-user-pill">{event.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
