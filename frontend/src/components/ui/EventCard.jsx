import { Link } from 'react-router-dom'
import styles from './EventCard.module.css'

export default function EventCard({ event }) {
  const {
    id,
    title,
    date,
    location_type,
    physical_address,
    ticket_tier,
    spots_left,
    cover_image,
  } = event

  return (
    <Link to={`/events/${id}`} className={styles.link}>
      <div className={styles.card}>

        <div className={styles.imgWrap}>
          {cover_image
            ? <img src={cover_image} alt={title} className={styles.img} />
            : <div className={styles.imgPlaceholder} />
          }
        </div>

        <div className={styles.body}>
          <p className={styles.title}>{title}</p>

          <div className={styles.meta}>
            <span>{date}</span>
          </div>

          <div className={styles.meta}>
            <span className={styles.tag}>{location_type}</span>
            {physical_address && (
              <span className={styles.tag}>{physical_address}</span>
            )}
          </div>

          <div className={styles.footer}>
            <span className={styles.tierName}>{ticket_tier ?? '—'}</span>
            {spots_left != null && (
              <span className={styles.spots}>{spots_left} spots left</span>
            )}
          </div>
        </div>

      </div>
    </Link>
  )
}