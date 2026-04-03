import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/dashboard',      label: 'Dashboard' },
  { to: '/events',         label: 'Browse Events' },
  { to: '/registrations',  label: 'My Registrations' },
  { to: '/tickets',        label: 'My Tickets' },
  { to: '/feedback',       label: 'Feedback' },
  { to: '/preferences',    label: 'Preferences' },
]

export default function Sidebar() {
  const { user } = useAuth()
  const role = user?.roles?.[0] ?? 'Attendee'

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoText}>Teq<span>Event</span></span>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [styles.navItem, isActive ? styles.active : ''].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.roleBadge}>
          <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
          <span className={styles.chevron}>⌄</span>
        </div>
      </div>
    </aside>
  )
}
