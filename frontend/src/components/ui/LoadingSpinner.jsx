import styles from './LoadingSpinner.module.css'

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.spinner} />
      {message && <p className={styles.message}>{message}</p>}
    </div>
  )
}