import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePanelTransition } from '../context/TransitionContext'
import { notificationsApi, collaboratorApi, inviteApi, adminApi } from '../services/api'

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/events': 'Discover',
  '/registrations': 'My Registrations',
  '/tickets': 'My Tickets',
  '/feedback': 'Feedback',
  '/profile': 'Profile Settings',
  '/organizer/profile': 'Profile Settings',
  '/organizer/dashboard': 'Organizer Dashboard',
  '/organizer/create-event': 'Create Event',
  '/organizer/manage-event': 'Manage Event',
  '/organizer/analytics': 'Analytics',
  '/organizer/agenda': 'Agenda',
  '/organizer/notifications': 'Notifications',
  '/admin/overview': 'Platform overview',
  '/admin/users':    'Users',
  '/admin/events':   'Events',
  '/admin/analytics':'Platform analytics',
}

const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M8 1.5a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9.5v-3a5 5 0 0 1 5-5Z" strokeLinejoin="round" />
    <path d="M6.5 13.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
  </svg>
)

const NOTIF_ICONS = {
  registration_confirmation: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', symbol: '✓' },
  approval:                  { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', symbol: '✓' },
  rejection:                 { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', symbol: '✕' },
  reminder:                  { bg: 'rgba(255,255,255,0.08)',color: 'rgba(255,255,255,0.6)', symbol: '◷' },
  feedback_request:          { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', symbol: '★' },
  waitlist_notification:     { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', symbol: '↑' },
  invite:                    { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', symbol: '✉' },
}

function fmtNotifTime(iso) {
  if (!iso) return ''
  const diffMs   = Date.now() - new Date(iso.replace('T', ' ')).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1)  return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24)  return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7)  return `${diffDays}d ago`
  return `${Math.floor(diffDays / 7)}w ago`
}

const IconMenu = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6">
    <line x1="2" y1="5"  x2="16" y2="5"  strokeLinecap="round" />
    <line x1="2" y1="9"  x2="16" y2="9"  strokeLinecap="round" />
    <line x1="2" y1="13" x2="16" y2="13" strokeLinecap="round" />
  </svg>
)

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6" cy="6" r="4.6" />
    <path d="M9.5 9.5 13 13" strokeLinecap="round" />
  </svg>
)

const IconChevronDown = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="2,4 5.5,7.5 9,4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7" cy="7" r="2.2" />
    <path d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3 3l1 1M10 10l1 1M3 11l1-1M10 4l1-1" strokeLinecap="round" />
  </svg>
)

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" strokeLinecap="round" />
    <path d="M9 10l3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="7" x2="5" y2="7" strokeLinecap="round" />
  </svg>
)

function getInitials(user) {
  if (!user) return 'U'
  const first = user.first_name?.[0] ?? ''
  const last = user.last_name?.[0] ?? ''
  return `${first}${last}`.trim().toUpperCase() || 'U'
}

export default function TopBar({ onHamburger }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, activeRole, switchRole, logout } = useAuth()
  const triggerTransition = usePanelTransition()

  // profile dropdown
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // notification bell
  const [bellOpen, setBellOpen]           = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [notifLoading, setNotifLoading]   = useState(false)
  const [inviteActions, setInviteActions] = useState({})
  const bellRef = useRef(null)

  // global admin search
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchResults, setSearchResults] = useState({ users: [], events: [] })
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef   = useRef(null)
  const searchTimer = useRef(null)
  const eventsCache = useRef(null)

  const title = routeTitles[pathname] ?? ''
  const fullName = useMemo(() => {
    if (!user) return 'Your profile'
    return `${user.first_name} ${user.last_name}`
  }, [user])

  // click-outside closes all dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current   && !menuRef.current.contains(e.target))   setMenuOpen(false)
      if (bellRef.current   && !bellRef.current.contains(e.target))    setBellOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target))  setSearchOpen(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // fetch unread count on mount and every 60s
  const fetchUnreadCount = useCallback(() => {
    if (!user) return
    notificationsApi.getUnreadCount()
      .then(r => setUnreadCount(r.data.unread_count))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // reset events cache when leaving admin panel
  const isAdminPanel = pathname.startsWith('/admin')
  useEffect(() => {
    if (!isAdminPanel) {
      eventsCache.current = null
      setSearchQuery('')
      setSearchOpen(false)
    }
  }, [isAdminPanel])

  // run search when query changes (admin panel only)
  useEffect(() => {
    if (!isAdminPanel) return
    const q = searchQuery.trim()
    if (!q) { setSearchResults({ users: [], events: [] }); setSearchOpen(false); return }

    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true)
      setSearchOpen(true)
      try {
        const eventsPromise = eventsCache.current !== null
          ? Promise.resolve(eventsCache.current)
          : adminApi.listEvents().then(r => {
              eventsCache.current = Array.isArray(r.data) ? r.data : []
              return eventsCache.current
            }).catch(() => [])

        const [usersData, allEvents] = await Promise.all([
          adminApi.listUsers({ search: q }).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
          eventsPromise,
        ])
        const ql = q.toLowerCase()
        setSearchResults({
          users:  usersData.slice(0, 4),
          events: allEvents.filter(e => e.title?.toLowerCase().includes(ql)).slice(0, 4),
        })
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(searchTimer.current)
  }, [searchQuery, isAdminPanel])

  const handleSearchSelect = useCallback((href) => {
    navigate(href)
    setSearchQuery('')
    setSearchOpen(false)
    setMenuOpen(false)
    setBellOpen(false)
  }, [navigate])

  const openBell = () => {
    setMenuOpen(false)
    if (bellOpen) { setBellOpen(false); return }
    setBellOpen(true)
    setNotifLoading(true)
    notificationsApi.list()
      .then(r => {
        const sorted = [...r.data].sort((a, b) =>
          (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        setNotifications(sorted)
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false))
  }

  const markRead = (id) => {
    notificationsApi.markRead(id).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAll = () => {
    notificationsApi.markAllRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const handleInviteAction = async (notif, action) => {
    if (!notif.event_id) {
      setInviteActions(prev => ({ ...prev, [notif.id]: { loading: null, isError: true, msg: 'Missing event ID — re-send the invite.' } }))
      return
    }
    setInviteActions(prev => ({ ...prev, [notif.id]: { loading: action, msg: null } }))
    try {
      const isAttendanceInvite = notif.message?.includes('attend')

      if (isAttendanceInvite) {
        if (action === 'accept') {
          const res = await inviteApi.acceptInvite(notif.event_id)
          markRead(notif.id)
          if (res.data.requires_payment === true) {
            setNotifications(prev => prev.filter(n => n.id !== notif.id))
            navigate(`/events/${notif.event_id}/register`)
          } else {
            setInviteActions(prev => ({
              ...prev,
              [notif.id]: { loading: null, done: true, isError: false, msg: 'You are now registered!' },
            }))
          }
        } else {
          await inviteApi.declineInvite(notif.event_id)
          markRead(notif.id)
          setInviteActions(prev => ({
            ...prev,
            [notif.id]: { loading: null, done: true, isError: false, msg: 'Invitation declined.' },
          }))
        }
      } else {
        if (action === 'accept') {
          await collaboratorApi.acceptInvite(notif.event_id)
        } else {
          await collaboratorApi.declineInvite(notif.event_id)
        }
        markRead(notif.id)
        setNotifications(prev => prev.filter(n => n.id !== notif.id))
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) && detail.length > 0 ? (detail[0]?.msg ?? 'Validation error')
        : 'Failed to process invite.'
      setInviteActions(prev => ({
        ...prev,
        [notif.id]: { loading: null, done: true, isError: true, msg },
      }))
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSwitchRole = (role) => {
    setMenuOpen(false)
    triggerTransition(() => {
      switchRole(role)
      navigate(role === 'organizer' ? '/organizer/dashboard' : '/dashboard')
    })
  }

  const profileHref  = isAdminPanel ? '/admin/profile'
    : activeRole === 'organizer'    ? '/organizer/profile'
    : '/profile'

  return (
    <header className="topbar">
      {onHamburger && (
        <button className="topbar-hamburger" onClick={onHamburger} aria-label="Toggle navigation" type="button">
          <IconMenu />
        </button>
      )}
      <span className="topbar-title">{title}</span>

      {/* ── global admin search ── */}
      {isAdminPanel && (
        <div className="topbar-search-wrap" ref={searchRef}>
          <label className="topbar-search">
            <IconSearch />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setSearchOpen(true)}
              placeholder="Search events, users…"
              aria-label="Global search"
            />
            {searchQuery && (
              <button
                className="topbar-search-clear"
                onClick={() => { setSearchQuery(''); setSearchOpen(false) }}
                aria-label="Clear search"
                type="button"
              >
                ×
              </button>
            )}
          </label>

          {searchOpen && (
            <div className="topbar-search-dropdown" role="listbox">
              {searchLoading ? (
                <p className="topbar-search-empty">Searching…</p>
              ) : searchResults.users.length === 0 && searchResults.events.length === 0 ? (
                <p className="topbar-search-empty">No results for &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <>
                  {searchResults.users.length > 0 && (
                    <div className="topbar-search-group">
                      <span className="topbar-search-group-label">Users</span>
                      {searchResults.users.map(u => (
                        <button
                          key={u.id}
                          className="topbar-search-item"
                          onClick={() => handleSearchSelect(`/admin/users/${u.id}`)}
                          type="button"
                        >
                          <span className="topbar-search-avatar">
                            {getInitials(u)}
                          </span>
                          <span className="topbar-search-copy">
                            <span>{u.first_name} {u.last_name}</span>
                            <small>{u.email}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.events.length > 0 && (
                    <div className="topbar-search-group">
                      <span className="topbar-search-group-label">Events</span>
                      {searchResults.events.map(e => (
                        <button
                          key={e.id}
                          className="topbar-search-item"
                          onClick={() => handleSearchSelect(`/admin/events/${e.id}`)}
                          type="button"
                        >
                          <span className="topbar-search-event-icon" />
                          <span className="topbar-search-copy">
                            <span>{e.title}</span>
                            <small>{e.status}{e.location_type ? ` · ${e.location_type}` : ''}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="topbar-actions">

        {/* ── notification bell ── */}
        <div className="notif-wrap" ref={bellRef}>
          <button
            className={`notif-bell${bellOpen ? ' notif-bell--open' : ''}`}
            onClick={openBell}
            aria-label="Notifications"
          >
            <IconBell />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {bellOpen && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-head">
                <span className="notif-dropdown-title">Notifications</span>
                {notifications.some(n => !n.is_read) && (
                  <button className="notif-mark-all" onClick={markAll}>Mark all read</button>
                )}
              </div>

              <div className="notif-list">
                {notifLoading ? (
                  <p className="notif-empty">Loading…</p>
                ) : notifications.length === 0 ? (
                  <p className="notif-empty">You're all caught up.</p>
                ) : notifications.map(n => {
                  const icon      = NOTIF_ICONS[n.type] ?? NOTIF_ICONS.reminder
                  const isInvite  = n.type === 'invite'
                  const invState  = inviteActions[n.id] ?? {}

                  const body = (
                    <>
                      <span className="notif-icon" style={{ background: icon.bg, color: icon.color }}>
                        {icon.symbol}
                      </span>
                      <span className="notif-body">
                        <span className="notif-title">{n.title}</span>
                        <span className="notif-msg">{n.message}</span>
                        <span className="notif-time">{fmtNotifTime(n.created_at)}</span>
                        {isInvite && invState.msg && (
                          <span style={{
                            display: 'block', marginTop: 6, fontSize: 11,
                            color: invState.isError ? '#ef4444' : '#22c55e',
                          }}>
                            {invState.msg}
                          </span>
                        )}
                        {isInvite && !n.is_read && !invState.msg && (
                          <span
                            style={{ display: 'flex', gap: 6, marginTop: 8 }}
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              className="notif-invite-btn notif-invite-btn--accept"
                              disabled={!!invState.loading}
                              onClick={() => handleInviteAction(n, 'accept')}
                            >
                              {invState.loading === 'accept' ? '…' : 'Accept'}
                            </button>
                            <button
                              className="notif-invite-btn notif-invite-btn--decline"
                              disabled={!!invState.loading}
                              onClick={() => handleInviteAction(n, 'decline')}
                            >
                              {invState.loading === 'decline' ? '…' : 'Decline'}
                            </button>
                          </span>
                        )}
                      </span>
                      {!n.is_read && <span className="notif-unread-dot" />}
                    </>
                  )

                  return isInvite ? (
                    <div
                      key={n.id}
                      className={`notif-item${n.is_read ? '' : ' notif-item--unread'}`}
                      onClick={() => markRead(n.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {body}
                    </div>
                  ) : (
                    <button
                      key={n.id}
                      className={`notif-item${n.is_read ? '' : ' notif-item--unread'}`}
                      onClick={() => markRead(n.id)}
                    >
                      {body}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── profile menu ── */}
        <div className="profile-menu" ref={menuRef}>
          <button
            className={`profile-card${menuOpen ? ' open' : ''}`}
            onClick={() => { setBellOpen(false); setMenuOpen(o => !o) }}
            aria-expanded={menuOpen}
          >
            <span className="profile-avatar" aria-hidden="true">{getInitials(user)}</span>
            <span className="profile-meta">
              <span className="profile-name">{fullName}</span>
              <span className="profile-role">{isAdminPanel ? 'Admin' : activeRole}</span>
            </span>
            <span className="profile-chevron" aria-hidden="true">
              <IconChevronDown />
            </span>
          </button>

          {menuOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-head">
                <span className="profile-avatar large" aria-hidden="true">{getInitials(user)}</span>
                <div className="profile-dropdown-copy">
                  <p className="profile-dropdown-name">{fullName}</p>
                  <p className="profile-dropdown-email">{user?.email}</p>
                </div>
              </div>

              <Link to={profileHref} className="profile-dropdown-link" onClick={() => setMenuOpen(false)}>
                <IconSettings /> Profile settings
              </Link>
              {isAdminPanel ? (
                <>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-link" onClick={() => handleSwitchRole('attendee')}>
                    Attendee panel
                  </button>
                  {user?.is_organizer && (
                    <button className="profile-dropdown-link" onClick={() => handleSwitchRole('organizer')}>
                      Organizer panel
                    </button>
                  )}
                </>
              ) : (
                <>
                  {user?.is_organizer && (
                    <>
                      <div className="profile-dropdown-divider" />
                      {activeRole !== 'attendee' ? (
                        <button className="profile-dropdown-link" onClick={() => handleSwitchRole('attendee')}>
                          Switch to attendee
                        </button>
                      ) : (
                        <button className="profile-dropdown-link" onClick={() => handleSwitchRole('organizer')}>
                          Switch to organizer
                        </button>
                      )}
                    </>
                  )}
                  {user?.is_admin && (
                    <>
                      <div className="profile-dropdown-divider" />
                      <button className="profile-dropdown-link" onClick={() => { setMenuOpen(false); triggerTransition(() => navigate('/admin/overview')) }}>
                        Admin panel
                      </button>
                    </>
                  )}
                </>
              )}
              <button className="profile-dropdown-link" onClick={handleLogout}>
                <IconLogout /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
