import { useState, useEffect } from 'react'
import { adminApi } from '../../services/api'

function exportCSV(events, users, analytics) {
  const now = new Date().toISOString().slice(0, 10)

  // Sheet 1 — events
  const evRows = [
    ['ID','Title','Status','Organizer','Date','Capacity','Location','Type','Free','Created'],
    ...events.map(e => [
      e.id,
      `"${(e.title ?? '').replace(/"/g, '""')}"`,
      e.status,
      e.owner_email ?? `#${e.owner_id}`,
      e.start_datetime?.slice(0, 10) ?? '',
      e.capacity ?? '',
      `"${(e.physical_address ?? (e.location_type === 'online' ? 'Remote' : '')).replace(/"/g, '""')}"`,
      e.location_type,
      e.is_free ? 'Yes' : 'No',
      e.created_at?.slice(0, 10) ?? '',
    ]),
  ]

  // Sheet 2 — users
  const userRows = [
    ['ID','First Name','Last Name','Email','Role','Active','Joined'],
    ...users.map(u => [
      u.id,
      `"${(u.first_name ?? '').replace(/"/g, '""')}"`,
      `"${(u.last_name ?? '').replace(/"/g, '""')}"`,
      u.email,
      u.role ?? (u.is_admin ? 'Admin' : u.is_organizer ? 'Organizer' : 'Attendee'),
      u.is_active ? 'Yes' : 'No',
      u.created_at?.slice(0, 10) ?? '',
    ]),
  ]

  // Summary block
  const summary = [
    ['--- PLATFORM SUMMARY ---'],
    ['Total Users', users.length],
    ['Total Events', events.length],
    ['Active Events', events.filter(e => e.status === 'published').length],
    ['Platform Revenue', analytics?.total_revenue ?? 0],
    ['Exported At', now],
  ]

  const sections = [
    '--- EVENTS ---',
    ...evRows.map(r => r.join(',')),
    '',
    '--- USERS ---',
    ...userRows.map(r => r.join(',')),
    '',
    ...summary.map(r => r.join(',')),
  ]

  const blob = new Blob([sections.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `teqevent-export-${now}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getLast12Months() {
  const result = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const y = now.getFullYear()
    const m = now.getMonth() - i
    const d = new Date(y, m, 1)
    const year  = d.getFullYear()
    const month = d.getMonth()
    const key   = `${year}-${String(month + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short' })
    result.push({ year, month, key, label })
  }
  return result
}

function fmtRevenue(val) {
  const n = parseFloat(val)
  if (!n || isNaN(n)) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toLocaleString()}`
}

function fmtRelative(iso) {
  if (!iso) return ''
  const diffMs   = Date.now() - new Date(iso.replace('T', ' ')).getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1d ago'
  if (diffDays < 30)  return `${diffDays}d ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

// ── SVG charts ────────────────────────────────────────────────────────────────

function LineChart({ data, labels }) {
  const W = 500, H = 140, PL = 36, PR = 8, PT = 12, PB = 28
  const cW = W - PL - PR
  const cH = H - PT - PB
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: PL + (i / (data.length - 1)) * cW,
    y: PT + cH - (v / max) * cH,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area     = `${pts[0].x},${PT + cH} ` + polyline + ` ${pts[pts.length - 1].x},${PT + cH}`
  const yTicks   = [0, Math.round(max / 2), max]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="adm-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.00" />
        </linearGradient>
      </defs>

      {yTicks.map(v => {
        const y = PT + cH - (v / max) * cH
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="end">{v}</text>
          </g>
        )
      })}

      <polygon points={area} fill="url(#adm-line-fill)" />
      <polyline points={polyline} fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" />
      ))}

      {labels.filter((_, i) => i % 2 === 0).map((label, j) => {
        const i = j * 2
        return (
          <text key={label} x={pts[i]?.x ?? 0} y={H - 4} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">{label}</text>
        )
      })}
    </svg>
  )
}

function BarChart({ data, labels }) {
  const W = 460, H = 140, PL = 36, PR = 8, PT = 12, PB = 28
  const cW = W - PL - PR
  const cH = H - PT - PB
  const max  = Math.max(...data, 1)
  const gap  = 3
  const barW = (cW / data.length) - gap

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {[0, Math.round(max / 2), max].map(v => {
        const y = PT + cH - (v / max) * cH
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="end">{v}</text>
          </g>
        )
      })}

      {data.map((v, i) => {
        const x   = PL + i * (barW + gap)
        const bH  = (v / max) * cH || 1
        const y   = PT + cH - bH
        const isLast = i === data.length - 1
        return (
          <rect key={i} x={x} y={y} width={barW} height={bH}
            fill={isLast ? '#fff' : 'rgba(255,255,255,0.25)'} rx="2" />
        )
      })}

      {labels.filter((_, i) => i % 2 === 0).map((label, j) => {
        const i = j * 2
        const x = PL + i * (barW + gap) + barW / 2
        return (
          <text key={label} x={x} y={H - 4} fill="rgba(255,255,255,0.35)" fontSize="9" textAnchor="middle">{label}</text>
        )
      })}
    </svg>
  )
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon }) {
  return (
    <div className="adm-stat-card">
      <div className="adm-stat-top">
        <span className="adm-stat-label">{label}</span>
        <span className="adm-stat-icon">{icon}</span>
      </div>
      <span className="adm-stat-value">{value}</span>
      {sub && <span className="adm-stat-sub">{sub}</span>}
    </div>
  )
}

// ── icons ─────────────────────────────────────────────────────────────────────

const IcoUsers   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="5" cy="4" r="2.5"/><path d="M0.5 13c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5" strokeLinecap="round"/><circle cx="10.5" cy="4.5" r="2"/><path d="M12.5 13c0-1.6-.9-3-2.2-3.8" strokeLinecap="round"/></svg>
const IcoEvents  = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x=".5" y="1.5" width="13" height="12" rx="1.5"/><line x1=".5" y1="5.5" x2="13.5" y2="5.5"/><line x1="4" y1="0" x2="4" y2="3" strokeLinecap="round"/><line x1="10" y1="0" x2="10" y2="3" strokeLinecap="round"/></svg>
const IcoRevenue = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="1,10 5,6 8,8 13,2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoCheck   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="2,7 5.5,10.5 12,4" strokeLinecap="round" strokeLinejoin="round"/></svg>

// ── component ─────────────────────────────────────────────────────────────────

export default function AdminOverview() {
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [analytics, setAnalytics]   = useState(null)
  const [users, setUsers]           = useState([])
  const [events, setEvents]         = useState([])

  useEffect(() => {
    // Track which calls actually failed vs returned empty data
    let usersFailed = false
    let eventsFailed = false

    Promise.all([
      adminApi.analytics().then(r => r.data).catch(() => null),
      adminApi.listUsers().then(r => r.data).catch(() => { usersFailed = true; return [] }),
      adminApi.listEvents().then(r => r.data).catch(() => { eventsFailed = true; return [] }),
    ])
      .then(([analyticsData, usersData, eventsData]) => {
        // Only show error if both core data sources failed (network error, not empty DB)
        if (usersFailed && eventsFailed) {
          setError(true)
          return
        }
        setAnalytics(analyticsData)
        setUsers(Array.isArray(usersData) ? usersData : [])
        setEvents(Array.isArray(eventsData) ? eventsData : [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="ed-state">Loading…</div>
  if (error)   return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load platform data.</p>
    </div>
  )

  const months     = getLast12Months()
  const thisMonth  = months[months.length - 1].key

  // Stats — prefer live counts from lists, use analytics for revenue
  const totalUsers     = users.length
  const totalEvents    = events.length
  const activeEvents   = events.filter(e => e.status === 'published').length
  // analytics.total_revenue comes from platform_analytics table (Celery-computed).
  // If that table is empty (Celery hasn't run), total_revenue is 0 — not reliable.
  const analyticsComputed = analytics && parseFloat(analytics.total_revenue ?? 0) > 0
  const totalRevenue       = analytics?.total_revenue ?? 0
  const newUsersMonth  = users.filter(u => u.created_at?.slice(0, 7) === thisMonth).length
  const newEventsMonth = events.filter(e => e.created_at?.slice(0, 7) === thisMonth).length

  // Chart data
  const userGrowth   = months.map(m => users.filter(u => (u.created_at?.slice(0, 7) ?? '') <= m.key).length)
  const eventsPerMonth = months.map(m => events.filter(e => e.created_at?.slice(0, 7) === m.key).length)
  const chartLabels  = months.map(m => m.label)

  // Recent platform activity — derived from real user + event data
  const activityItems = [
    ...users
      .filter(u => u.created_at)
      .map(u => ({
        key:      `u-${u.id}`,
        type:     'user',
        initials: `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?',
        text:     `${u.first_name} ${u.last_name} joined TeqEvent`,
        time:     u.created_at,
      })),
    ...events
      .filter(e => e.created_at)
      .map(e => ({
        key:      `e-${e.id}`,
        type:     'event',
        initials: null,
        text:     `${e.owner_email ?? 'Organizer'} ${e.status === 'published' ? 'published' : 'created draft'} "${e.title}"`,
        time:     e.created_at,
      })),
  ]
    .sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
    .slice(0, 7)

  return (
    <div className="adm-wrap">

      {/* header */}
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Platform overview</h1>
          <p className="adm-sub">System-wide health, growth, and activity.</p>
        </div>
        <div className="adm-header-actions">
          <button className="adm-btn-secondary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="7" cy="7" r="6" />
              <line x1="4" y1="5" x2="10" y2="5" strokeLinecap="round" />
              <line x1="4" y1="7.5" x2="10" y2="7.5" strokeLinecap="round" />
              <line x1="4" y1="10" x2="7.5" y2="10" strokeLinecap="round" />
            </svg>
            Audit log
          </button>
          <button
            className="adm-btn-secondary"
            onClick={() => exportCSV(events, users, analytics)}
            disabled={loading || (!events.length && !users.length)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 10v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div className="adm-stat-grid">
        <StatCard
          label="TOTAL USERS"
          value={totalUsers.toLocaleString()}
          sub={newUsersMonth > 0 ? `+${newUsersMonth} this month` : 'No new users this month'}
          icon={<IcoUsers />}
        />
        <StatCard
          label="TOTAL EVENTS"
          value={totalEvents.toLocaleString()}
          sub={newEventsMonth > 0 ? `+${newEventsMonth} this month` : 'No new events this month'}
          icon={<IcoEvents />}
        />
        <StatCard
          label="PLATFORM REVENUE"
          value={analyticsComputed ? fmtRevenue(totalRevenue) : '—'}
          sub={analyticsComputed ? 'From confirmed registrations' : 'Requires analytics computation'}
          icon={<IcoRevenue />}
        />
        <StatCard
          label="ACTIVE EVENTS"
          value={activeEvents.toLocaleString()}
          sub={`${totalEvents - activeEvents} draft / cancelled`}
          icon={<IcoCheck />}
        />
      </div>

      {/* charts */}
      <div className="adm-charts-row">
        <div className="adm-chart-box">
          <p className="adm-chart-title">User growth</p>
          <p className="adm-chart-sub">Cumulative registered users · last 12 months</p>
          <LineChart data={userGrowth} labels={chartLabels} />
        </div>
        <div className="adm-chart-box">
          <p className="adm-chart-title">Event creation</p>
          <p className="adm-chart-sub">New events per month</p>
          <BarChart data={eventsPerMonth} labels={chartLabels} />
        </div>
      </div>

      {/* bottom row — activity + flagged */}
      <div className="adm-bottom-row">

        {/* recent platform activity */}
        <div className="adm-act-box">
          <p className="adm-act-heading">Recent platform activity</p>
          {activityItems.length === 0 ? (
            <p className="adm-act-empty">No recent activity to display.</p>
          ) : (
            <ul className="adm-act-list">
              {activityItems.map(item => (
                <li key={item.key} className="adm-act-item">
                  {item.type === 'user' ? (
                    <span className="adm-act-avatar">{item.initials}</span>
                  ) : (
                    <span className="adm-act-avatar adm-act-avatar--event">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                        <rect x=".5" y="1" width="11" height="10.5" rx="1.3" />
                        <line x1=".5" y1="4.5" x2="11.5" y2="4.5" />
                        <line x1="3.5" y1="0" x2="3.5" y2="2.5" strokeLinecap="round" />
                        <line x1="8.5" y1="0" x2="8.5" y2="2.5" strokeLinecap="round" />
                      </svg>
                    </span>
                  )}
                  <span className="adm-act-text">{item.text}</span>
                  <span className="adm-act-time">{fmtRelative(item.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* flagged activity */}
        <div className="adm-act-box">
          <p className="adm-act-heading">Flagged activity</p>
          <div className="adm-flagged-empty">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4">
              <path d="M6 4v20M6 4h13l-3 6 3 6H6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p>No flagged activity to review.</p>
            <span>Reported events and users will appear here once the moderation system is active.</span>
          </div>
        </div>

      </div>

    </div>
  )
}
