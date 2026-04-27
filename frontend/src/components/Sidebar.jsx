import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const IconSwitch = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 4h10M9 2l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 10H3M5 8l-2 2 2 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="0" y="0" width="6.5" height="6.5" rx="1.2" />
    <rect x="8.5" y="0" width="6.5" height="6.5" rx="1.2" />
    <rect x="0" y="8.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.2" />
  </svg>
)

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="6.5" cy="6.5" r="5" />
    <line x1="10.5" y1="10.5" x2="14" y2="14" strokeLinecap="round" />
  </svg>
)

const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="2.5" width="13" height="11.5" rx="1.5" />
    <line x1="1" y1="6" x2="14" y2="6" />
    <line x1="4.5" y1="1" x2="4.5" y2="4" strokeLinecap="round" />
    <line x1="10.5" y1="1" x2="10.5" y2="4" strokeLinecap="round" />
  </svg>
)

const IconTicket = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1.5a1.5 1.5 0 0 0 0 3V11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V9.5a1.5 1.5 0 0 0 0-3V5Z" />
  </svg>
)

const IconChat = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1.5 2.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4.5L1 14V3.5a1 1 0 0 1 .5-.87V2.5Z" strokeLinejoin="round" />
  </svg>
)

const IconBell = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7.5 1.5A4 4 0 0 0 3.5 5.5V9l-1.5 2h11L11.5 9V5.5A4 4 0 0 0 7.5 1.5Z" strokeLinejoin="round" />
    <path d="M6 11.5a1.5 1.5 0 0 0 3 0" />
  </svg>
)

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" strokeLinecap="round" />
    <path d="M9 10l3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="7" x2="5" y2="7" strokeLinecap="round" />
  </svg>
)

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 2l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { to: '/events', label: 'Discover', icon: <IconSearch /> },
  { to: '/registrations', label: 'My Registrations', icon: <IconCalendar /> },
  { to: '/tickets', label: 'My Tickets', icon: <IconTicket /> },
  { to: '/feedback', label: 'Feedback', icon: <IconChat /> },
  { to: '/preferences', label: 'Preferences', icon: <IconBell /> },
]

export default function Sidebar() {
  const { user, logout, switchRole } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  )

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSwitchToOrganizer = () => {
    switchRole('organizer')
    navigate('/organizer/dashboard')
  }

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">T</span>
        <span className="sidebar-logo-name">eqEvent</span>
        <button className="sidebar-collapse-btn" onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {user?.is_organizer && (
          <button className="role-switch-btn" onClick={handleSwitchToOrganizer} title="Switch to Organizer view">
            <IconSwitch />
            Organizer view
          </button>
        )}
        <div className="sidebar-user">
          <span className="sidebar-user-name">
            {user ? `${user.first_name} ${user.last_name}` : '—'}
          </span>
          <span className="sidebar-user-role">Attendee</span>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign out">
          <IconLogout />
        </button>
      </div>
    </aside>
  )
}
