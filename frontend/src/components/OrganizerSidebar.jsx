import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const IconDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="0" y="0" width="6.5" height="6.5" rx="1.2" />
    <rect x="8.5" y="0" width="6.5" height="6.5" rx="1.2" />
    <rect x="0" y="8.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.2" />
  </svg>
)

const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="7.5" y1="2" x2="7.5" y2="13" strokeLinecap="round" />
    <line x1="2" y1="7.5" x2="13" y2="7.5" strokeLinecap="round" />
  </svg>
)

const IconFolder = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 4a1 1 0 0 1 1-1h3.5l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Z" strokeLinejoin="round" />
  </svg>
)

const IconChart = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="1,11 5,7 8,9 14,3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconLayers = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polygon points="7.5,1 14,5 7.5,9 1,5" strokeLinejoin="round" />
    <polyline points="1,10 7.5,14 14,10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M13 2L1 7l5 2.5L8.5 14 13 2Z" strokeLinejoin="round" />
  </svg>
)

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" strokeLinecap="round" />
    <path d="M9 10l3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="7" x2="5" y2="7" strokeLinecap="round" />
  </svg>
)

const IconSwitch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 4h10M9 2l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 10H3M5 8l-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="9,3 5,7 9,11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="5,3 9,7 5,11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const navItems = [
  { to: '/organizer/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { to: '/organizer/create-event', label: 'Create Event', icon: <IconPlus /> },
  { to: '/organizer/manage-event', label: 'Manage Event', icon: <IconFolder /> },
  { to: '/organizer/analytics', label: 'Analytics', icon: <IconChart /> },
  { to: '/organizer/agenda', label: 'Agenda', icon: <IconLayers /> },
  { to: '/organizer/notifications', label: 'Notifications', icon: <IconSend /> },
]

export default function OrganizerSidebar() {
  const { user, logout, switchRole } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSwitchToAttendee = () => {
    switchRole('attendee')
    navigate('/dashboard')
  }

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <span>Teq<span className="logo-text">Event</span></span>
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>

      <div className="sidebar-role-label nav-label">ORGANIZER</div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            {item.icon}
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <button className="role-switch-btn" onClick={handleSwitchToAttendee} title="Switch to Attendee view">
          <IconSwitch />
          <span className="nav-label">Attendee view</span>
        </button>
        <div className="sidebar-user">
          <span className="sidebar-user-name">
            {user ? `${user.first_name} ${user.last_name}` : '—'}
          </span>
          <span className="sidebar-user-role nav-label">Organizer</span>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign out">
          <IconLogout />
        </button>
      </div>

    </aside>
  )
}
