import { useLocation } from 'react-router-dom'

const routeTitles = {
  '/dashboard': 'Dashboard',
  '/events': 'Browse Events',
  '/registrations': 'My Registrations',
  '/tickets': 'My Tickets',
  '/feedback': 'Feedback',
  '/preferences': 'Preferences',
}

const IconBell = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M7.5 1.5A4 4 0 0 0 3.5 5.5V9l-1.5 2h11L11.5 9V5.5A4 4 0 0 0 7.5 1.5Z" strokeLinejoin="round" />
    <path d="M6 11.5a1.5 1.5 0 0 0 3 0" />
  </svg>
)

const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="7.5" cy="5" r="3" />
    <path d="M1.5 14c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
  </svg>
)

export default function TopBar() {
  const { pathname } = useLocation()
  const title = routeTitles[pathname] ?? ''

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        <button className="topbar-btn">
          <IconBell />
        </button>
        <button className="topbar-btn">
          <IconUser />
        </button>
      </div>
    </header>
  )
}
