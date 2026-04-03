import styles from './EmptyState.module.css'

export default function EmptyState({ title, subtitle, action, onAction }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="3" width="22" height="22" rx="3" stroke="#3e474d" strokeWidth="1.5" />
          <path d="M9 14h10M14 9v10" stroke="#3e474d" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className={styles.title}>{title}</p>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {action && onAction && (
        <button className={styles.action} onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}