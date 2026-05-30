import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { eventsApi, categoriesApi, organizerApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const PERIOD_DAYS = { '7D': 7, '30D': 30, '90D': 90 }

function fmtRevenue(val) {
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`
  return `$${val}`
}

function RegistrationsChart({ points }) {
  const W = 520; const H = 160; const padX = 8; const padY = 12
  const iW = W - padX * 2; const iH = H - padY * 2

  if (!points || points.length < 2) {
    return (
      <div className="chart-wrap" style={{ alignItems: 'center', justifyContent: 'center', height: H }}>
        <span style={{ opacity: 0.4, fontSize: 12 }}>No data</span>
      </div>
    )
  }

  const maxCount = Math.max(...points.map(p => p.count), 1)

  const pts = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * iW
    const y = padY + iH - (p.count / maxCount) * iH
    return [x, y]
  })

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const fill = `${padX},${padY + iH} ${polyline} ${padX + iW},${padY + iH}`

  const yStep = maxCount / 4
  const yLabelsArr = [maxCount, Math.round(yStep * 3), Math.round(yStep * 2), Math.round(yStep), 0]

  const step = Math.max(1, Math.floor(points.length / 6))
  const xLabels = points
    .map((p, i) => {
      if (i % step !== 0) return null
      const d = new Date(p.date)
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, x: padX + (i / (points.length - 1)) * iW }
    })
    .filter(Boolean)

  return (
    <div className="chart-wrap">
      <div className="chart-ylabels">
        {yLabelsArr.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
          <defs>
            <linearGradient id="orgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
            </linearGradient>
          </defs>
          <polygon points={fill} fill="url(#orgGrad)" />
          <polyline points={polyline} fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="white" />
          ))}
        </svg>
        <div className="chart-xlabels">
          {xLabels.map(({ label }, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

const IconAnalytics = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="1,10 4,6 7,8 12,2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="6.5" y1="1.5" x2="6.5" y2="11.5" strokeLinecap="round" />
    <line x1="1.5" y1="6.5" x2="11.5" y2="6.5" strokeLinecap="round" />
  </svg>
)

const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="4" r="2.5" />
    <path d="M1 11c0-2.2 1.8-4 4-4s4 1.8 4 4" strokeLinecap="round" />
    <circle cx="10" cy="4" r="1.8" />
    <path d="M11.5 11c0-1.6-0.9-3-2.2-3.7" strokeLinecap="round" />
  </svg>
)

const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 1L1 6l4 2.5L7.5 12 12 1Z" strokeLinejoin="round" />
  </svg>
)

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

export default function OrganizerDashboard() {
  const [period, setPeriod] = useState('90D')
  const { user } = useAuth()
  const [activeEvents, setActiveEvents] = useState([])
  const [statsData, setStatsData] = useState(null)
  const [timelinePoints, setTimelinePoints] = useState([])
  const [activity, setActivity] = useState([])

  useEffect(() => {
    if (!user) return
    Promise.all([
      eventsApi.list({ limit: 100 }),
      categoriesApi.list(),
    ]).then(([evRes, catRes]) => {
      const catMap = Object.fromEntries(catRes.data.map(c => [c.id, c.name]))
      const mine = (evRes.data?.items ?? [])
        .filter(e => e.owner_id === user.id)
        .map(e => ({
          id: e.id,
          category: e.category_ids?.length ? (catMap[e.category_ids[0]] ?? '—') : '—',
          title: e.title,
          location: e.location_type === 'online' ? 'Remote' : (e.physical_address || '—'),
          date: fmtDate(e.start_datetime),
          capacity: e.capacity ?? '∞',
        }))
      setActiveEvents(mine)
    }).catch(() => {})

    organizerApi.getStats().then(res => setStatsData(res.data)).catch(() => {})
    organizerApi.getActivity().then(res => setActivity(res.data)).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) return
    organizerApi.getTimeline(PERIOD_DAYS[period])
      .then(res => setTimelinePoints(res.data))
      .catch(() => {})
  }, [user, period])

  const statsCards = [
    { label: 'TOTAL EVENTS', value: statsData ? String(statsData.total_events) : '—' },
    { label: 'REGISTRATIONS', value: statsData ? String(statsData.total_registrations) : '—' },
    { label: 'REVENUE', value: statsData ? fmtRevenue(statsData.total_revenue) : '—' },
    { label: 'ATTENDANCE RATE', value: statsData ? `${statsData.attendance_rate.toFixed(1)}%` : '—' },
  ]

  return (
    <div>
      <div className="org-header">
        <div>
          <h1 className="org-title">Organizer overview</h1>
          <p className="org-sub">Your events, registrations, and revenue at a glance.</p>
        </div>
        <div className="org-header-actions">
          <Link to="/organizer/analytics" className="btn-outline-sm">
            <IconAnalytics /> Analytics
          </Link>
          <Link to="/organizer/create-event" className="btn-primary-sm">
            <IconPlus /> Create event
          </Link>
        </div>
      </div>

      <div className="org-stats">
        {statsCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="org-body">
        <div className="org-main">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Registrations over time</div>
                <div className="chart-sub">Last 12 weeks across all active events</div>
              </div>
              <div className="period-tabs">
                {['7D', '30D', '90D'].map((p) => (
                  <button
                    key={p}
                    className={`period-tab${period === p ? ' active' : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <RegistrationsChart points={timelinePoints} />
          </div>

          <div className="org-events-section">
            <div className="section-row">
              <h3 className="section-title">Your active events</h3>
              <Link to="/organizer/manage-event" className="view-all">View all →</Link>
            </div>
            <div className="org-table-wrap">
            <table className="org-table">
              <thead>
                <tr>
                  <th>EVENT</th>
                  <th>DATE</th>
                  <th>CAPACITY</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeEvents.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.4, padding: '16px' }}>No events yet</td></tr>
                ) : activeEvents.map((e) => (
                  <tr key={e.id} className="org-table-row">
                    <td>
                      <div className="org-event-cell">
                        <div className="event-list-thumb" style={{ fontSize: '8px' }}>
                          {e.category.toUpperCase()}
                        </div>
                        <div>
                          <div className="org-event-name">{e.title}</div>
                          <div className="org-event-loc">{e.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="org-td-muted">{e.date}</td>
                    <td>
                      <span className="org-capacity">{e.capacity}</span>
                    </td>
                    <td className="org-td-chevron">
                      <IconChevron />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div className="org-side">
          <div className="panel-card">
            <h3 className="panel-title">Quick actions</h3>
            <div className="quick-actions">
              <Link to="/organizer/create-event" className="quick-action">
                <IconPlus /> Create new event
              </Link>
              <Link to="/organizer/manage-event" className="quick-action">
                <IconUsers /> View registrations
              </Link>
              <Link to="/organizer/analytics" className="quick-action">
                <IconAnalytics /> View analytics
              </Link>
              <button className="quick-action">
                <IconSend /> Send announcement
              </button>
            </div>
          </div>

          <div className="panel-card">
            <h3 className="panel-title">Recent activity</h3>
            <div className="activity-feed">
              {activity.length === 0 ? (
                <div style={{ opacity: 0.4, fontSize: 12, padding: '8px 0' }}>No activity yet</div>
              ) : activity.map((a) => (
                <div key={a.id} className="activity-item">
                  <div className="activity-avatar">
                    {a.actor_initials}
                  </div>
                  <div className="activity-body">
                    <span className="activity-name">{a.actor_name}</span>{' '}
                    <span className="activity-action">{a.action}</span>
                    <div className="activity-time">{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
