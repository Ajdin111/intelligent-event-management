import styles from './Topbar.module.css'

export default function Topbar({ title }) {
  return (
    <header className={styles.topbar}>
      <span className={styles.title}>{title}</span>
      <div className={styles.actions}>
        <button className={styles.iconBtn} title="Notifications">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1a5 5 0 0 1 5 5c0 3.5-1.5 5-5 7C5.5 11 3 9.5 3 6a5 5 0 0 1 5-5z"/>
            <circle cx="8" cy="14.5" r="0.8" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button className={styles.iconBtn} title="Profile">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="5" r="3"/>
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
