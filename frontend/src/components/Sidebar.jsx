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

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 2H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" strokeLinecap="round" />
    <path d="M9 10l3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="7" x2="5" y2="7" strokeLinecap="round" />
  </svg>
)

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="9,3 5,7 9,11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: <IconDashboard /> },
  { to: '/events', label: 'Browse Events', icon: <IconSearch /> },
  { to: '/registrations', label: 'My Registrations', icon: <IconCalendar /> },
  { to: '/tickets', label: 'My Tickets', icon: <IconTicket /> },
  { to: '/feedback', label: 'Feedback', icon: <IconChat /> },
]

export default function Sidebar() {
  const { user, logout, activeRole } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
  <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
    <div className="sidebar-logo">
      {collapsed ? (
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title="Expand sidebar"
        >
          <span style={{ fontWeight: 700, fontSize: '16px' }}>T</span>
        </button>
      ) : (
        <>
          <span style={{ fontWeight: 700 }}>Teq<span style={{ fontWeight: 300 }}>Event</span></span>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(c => !c)}
            title="Collapse sidebar"
          >
            <IconChevronLeft />
          </button>
        </>
      )}
    </div>

    <div className="sidebar-role-label">ATTENDEE</div>

    <nav className="sidebar-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          {item.icon}
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>

    <div className="sidebar-bottom">
      <div className="sidebar-user">
        <span className="sidebar-user-name">
          {user ? `${user.first_name} ${user.last_name}` : '—'}
        </span>
        <span className="sidebar-user-role" style={{ textTransform: 'capitalize' }}>{activeRole}</span>
      </div>
      <button className="logout-btn" onClick={handleLogout} title="Sign out">
        <IconLogout />
      </button>
    </div>
  </aside>
)
}
