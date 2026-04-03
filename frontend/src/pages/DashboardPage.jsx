import Topbar from '../components/layout/Topbar'
import EventCard from '../components/ui/EventCard'
import { useAuth } from '../contexts/AuthContext'
import styles from './DashboardPage.module.css'

// ── Fake data — swap for api.get('/events') when backend is ready ──
const UPCOMING = [
  {
    id: 1,
    title: 'AI & Machine Learning Summit 2026',
    date: 'April 15, 2026',
    location_type: 'Online',
    ticket_tier: 'VIP Pass',
    spots_left: 45,
  },
  {
    id: 2,
    title: 'Global Tech Conference',
    date: 'May 8, 2026',
    location_type: 'Physical',
    physical_address: 'San Francisco, CA',
    ticket_tier: 'Early Bird',
    spots_left: 120,
  },
  {
    id: 3,
    title: 'Startup Ecosystem Workshop',
    date: 'June 2, 2026',
    location_type: 'Hybrid',
    ticket_tier: 'Standard',
    spots_left: 32,
  },
]

const RECOMMENDED = [
  {
    id: 4,
    title: 'Code & Hardware Expo',
    date: 'Jul 14, 2026',
    reason: 'Based on your history',
    location_type: 'Physical',
  },
  {
    id: 5,
    title: 'Mathematical Workshop',
    date: 'Aug 3, 2026',
    reason: 'Popular in category',
    location_type: 'Online',
  },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.first_name ?? 'Alex'

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>
        <h1 className={styles.greeting}>{greeting}, {firstName}</h1>

        <section>
          <p className={styles.sectionTitle}>Your Upcoming Events</p>
          <div className={styles.grid3}>
            {UPCOMING.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>

        <section>
          <p className={styles.sectionTitle}>AI Recommended Events</p>
          <div className={styles.grid2}>
            {RECOMMENDED.map((e) => (
              <div key={e.id} className={styles.recCard}>
                <div className={styles.recImg} />
                <span className={styles.recBadge}>Recommended</span>
                <div className={styles.recBody}>
                  <p className={styles.recTitle}>{e.title}</p>
                  <p className={styles.recSub}>{e.reason} · {e.date}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
