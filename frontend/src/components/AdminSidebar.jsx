import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const IconOverview = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
    <rect x="0" y="0" width="6.5" height="6.5" rx="1.2" />
    <rect x="8.5" y="0" width="6.5" height="6.5" rx="1.2" />
    <rect x="0" y="8.5" width="6.5" height="6.5" rx="1.2" />
    <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.2" />
  </svg>
)
const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="5.5" cy="4.5" r="2.5" />
    <path d="M0.5 13c0-2.8 2.2-5 5-5s5 2.2 5 5" strokeLinecap="round" />
    <circle cx="11" cy="4.5" r="2" />
    <path d="M13 13c0-1.8-0.9-3.3-2.3-4.2" strokeLinecap="round" />
  </svg>
)
const IconEvents = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="14" height="13" rx="1.5" strokeLinejoin="round" />
    <line x1="0.5" y1="5.5" x2="14.5" y2="5.5" />
    <line x1="4" y1="0" x2="4" y2="3" strokeLinecap="round" />
    <line x1="11" y1="0" x2="11" y2="3" strokeLinecap="round" />
  </svg>
)
const IconChart = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <polyline points="1,11 5,7 8,9 14,3" strokeLinecap="round" strokeLinejoin="round" />
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
  { to: '/admin/overview', label: 'Overview',  icon: <IconOverview /> },
  { to: '/admin/users',    label: 'Users',     icon: <IconUsers /> },
  { to: '/admin/events',   label: 'Events',    icon: <IconEvents /> },
  { to: '/admin/analytics',label: 'Analytics', icon: <IconChart /> },
]

export default function AdminSidebar({ mobileOpen = false, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!mobileOpen) setCollapsed(false)
  }, [mobileOpen])

  const handleCollapseBtn = () => mobileOpen ? onClose?.() : setCollapsed(c => !c)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--mobile-open' : ''}`}>
      <div className="sidebar-logo">
        {collapsed ? (
          <button className="sidebar-collapse-btn" onClick={handleCollapseBtn} title="Expand sidebar">
            <span style={{ fontWeight: 700, fontSize: '16px' }}>T</span>
          </button>
        ) : (
          <>
            <span style={{ fontWeight: 700 }}>Teq<span style={{ fontWeight: 300 }}>Event</span></span>
            <button className="sidebar-collapse-btn" onClick={handleCollapseBtn} title={mobileOpen ? 'Close' : 'Collapse sidebar'}>
              <IconChevronLeft />
            </button>
          </>
        )}
      </div>

      <div className="sidebar-role-label nav-label">ADMIN</div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={item.label}
            onClick={onClose}
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
          <span className="sidebar-user-role">Admin</span>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign out">
          <IconLogout />
        </button>
      </div>
    </aside>
  )
}
