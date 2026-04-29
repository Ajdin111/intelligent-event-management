import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/events': 'Discover',
  '/registrations': 'My Registrations',
  '/tickets': 'My Tickets',
  '/feedback': 'Feedback',
  '/profile': 'Profile Settings',
  '/organizer/dashboard': 'Organizer Dashboard',
  '/organizer/create-event': 'Create Event',
  '/organizer/manage-event': 'Manage Event',
  '/organizer/analytics': 'Analytics',
  '/organizer/agenda': 'Agenda',
  '/organizer/notifications': 'Notifications',
}

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

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, activeRole, switchRole, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const title = routeTitles[pathname] ?? ''
  const fullName = useMemo(() => {
    if (!user) return 'Your profile'
    return `${user.first_name} ${user.last_name}`
  }, [user])

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSwitchRole = (role) => {
    switchRole(role)
    setMenuOpen(false)
    navigate(role === 'organizer' ? '/organizer/dashboard' : '/dashboard')
  }

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        <div className="profile-menu" ref={menuRef}>
          <button
            className={`profile-card${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            <span className="profile-avatar" aria-hidden="true">{getInitials(user)}</span>
            <span className="profile-meta">
              <span className="profile-name">{fullName}</span>
              <span className="profile-role">{activeRole}</span>
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

              <Link to="/profile" className="profile-dropdown-link" onClick={() => setMenuOpen(false)}>
                <IconSettings /> Profile settings
              </Link>
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
