import { useState } from 'react'
import { Link } from 'react-router-dom'

const stats = [
  { label: 'TOTAL EVENTS', value: '18', change: '+2 this quarter' },
  { label: 'REGISTRATIONS', value: '4,218', change: '+412 this month' },
  { label: 'REVENUE', value: '$284.5k', change: '+18% QoQ' },
  { label: 'ATTENDANCE RATE', value: '91.4%', change: 'Above avg' },
]

const activeEvents = [
  { id: 'E1', category: 'AI & ML', title: 'Vector Summit 2026', location: 'San Francisco, CA', date: 'May 14, 2026', registered: 188, capacity: 600, revenue: '$56,212' },
  { id: 'E2', category: 'Cloud', title: 'EdgeCloud Conf', location: 'Austin, TX', date: 'Jun 03, 2026', registered: 312, capacity: 400, revenue: '$62,088' },
  { id: 'E3', category: 'Frontend', title: 'ReactNext: Motion', location: 'Berlin, DE', date: 'Jun 18, 2026', registered: 228, capacity: 250, revenue: '$0' },
  { id: 'E4', category: 'Security', title: 'ZeroTrust World', location: 'Remote', date: 'Jul 02, 2026', registered: 760, capacity: 2000, revenue: '$113,240' },
]

const recentActivity = [
  { id: 1, initials: 'AR', name: 'A. Rahimi', action: 'registered for Vector Summit 2026', time: '2m ago' },
  { id: 2, initials: 'JA', name: 'J. Alvarez', action: 'requested approval for EdgeCloud Conf', time: '18m ago' },
  { id: 3, initials: 'S', name: 'System', action: 'published ReactNext: Motion agenda', time: '1h ago', system: true },
  { id: 4, initials: 'KN', name: 'K. Nagata', action: 'left a 5-star review on Vector Summit', time: '3h ago' },
  { id: 5, initials: 'LO', name: 'L. Okafor', action: 'purchased VIP ticket for Vector Summit', time: '4h ago' },
  { id: 6, initials: 'S', name: 'System', action: 'sent 1,284 reminder emails', time: '6h ago', system: true },
]

const chartPoints = {
  '7D':  [0.05, 0.12, 0.22, 0.30, 0.45, 0.60, 0.75],
  '30D': [0.02, 0.08, 0.14, 0.22, 0.30, 0.42, 0.54, 0.65, 0.74, 0.82, 0.90, 1.0],
  '90D': [0.02, 0.07, 0.15, 0.22, 0.33, 0.44, 0.55, 0.65, 0.75, 0.84, 0.91, 1.0],
}

const yLabels = { '7D': ['75', '56', '37', '18', '0'], '30D': ['359', '269', '179', '90', '0'], '90D': ['359', '269', '179', '90', '0'] }

function RegistrationsChart({ period }) {
  const data = chartPoints[period]
  const W = 520; const H = 160; const padX = 8; const padY = 12
  const iW = W - padX * 2; const iH = H - padY * 2

  const pts = data.map((v, i) => {
    const x = padX + (i / (data.length - 1)) * iW
    const y = padY + iH - v * iH
    return [x, y]
  })

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const fill = `${padX},${padY + iH} ${polyline} ${padX + iW},${padY + iH}`

  const weeks = data.map((_, i) => {
    const label = period === '7D' ? `D${i + 1}` : `W${i * 2 + 1}`
    const x = padX + (i / (data.length - 1)) * iW
    return { label: i % 2 === 0 ? label : '', x }
  })

  return (
    <div className="chart-wrap">
      <div className="chart-ylabels">
        {(yLabels[period] || yLabels['90D']).map((l) => (
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
          {weeks.filter(w => w.label).map(({ label, x }, i) => (
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

export default function OrganizerDashboard() {
  const [period, setPeriod] = useState('90D')

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
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-change">↗ {s.change}</div>
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
            <RegistrationsChart period={period} />
          </div>

          <div className="org-events-section">
            <div className="section-row">
              <h3 className="section-title">Your active events</h3>
              <Link to="/organizer/manage-event" className="view-all">View all →</Link>
            </div>
            <table className="org-table">
              <thead>
                <tr>
                  <th>EVENT</th>
                  <th>DATE</th>
                  <th>REGISTERED</th>
                  <th>REVENUE</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeEvents.map((e) => (
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
                      <span style={{ fontWeight: 600 }}>{e.registered}</span>
                      <span className="org-capacity"> / {e.capacity}</span>
                    </td>
                    <td>{e.revenue}</td>
                    <td className="org-td-chevron">
                      <IconChevron />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {recentActivity.map((a) => (
                <div key={a.id} className="activity-item">
                  <div className={`activity-avatar${a.system ? ' system' : ''}`}>
                    {a.initials}
                  </div>
                  <div className="activity-body">
                    <span className="activity-name">{a.name}</span>{' '}
                    <span className="activity-action">{a.action}</span>
                    <div className="activity-time">{a.time}</div>
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
