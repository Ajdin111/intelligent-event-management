import { useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../../services/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLastNMonths(n) {
  const result = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short' })
    result.push({ key, label })
  }
  return result
}

function fmtRevenue(val) {
  const n = parseFloat(val)
  if (!n || isNaN(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtNum(n) {
  if (n == null || isNaN(Number(n))) return '—'
  const v = Number(n)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return v.toLocaleString()
}

function exportCSV(events, users) {
  const now  = new Date().toISOString().slice(0, 10)
  const rows = [
    ['ID','Title','Status','Location','Free','Registrations','Revenue','Organizer','Created'],
    ...events.map(e => [
      e.id,
      `"${(e.title ?? '').replace(/"/g, '""')}"`,
      e.status, e.location_type,
      e.is_free ? 'Yes' : 'No',
      e.total_registrations ?? 0,
      e.total_revenue ?? 0,
      e.owner_email ?? `#${e.owner_id}`,
      e.created_at?.slice(0, 10) ?? '',
    ]),
  ]
  const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `teqevent-analytics-${now}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── SVG: Line chart ───────────────────────────────────────────────────────────

function LineChart({ data, labels }) {
  const W = 500, H = 200, PL = 42, PR = 12, PT = 16, PB = 30
  const cW  = W - PL - PR
  const cH  = H - PT - PB
  const max = Math.max(...data, 1)
  const n   = data.length

  const pts = data.map((v, i) => ({
    x: n > 1 ? PL + (i / (n - 1)) * cW : PL + cW / 2,
    y: PT + cH - (v / max) * cH,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area     = `${pts[0].x},${PT + cH} ${polyline} ${pts[pts.length - 1].x},${PT + cH}`
  const yTicks   = [...new Set([0, Math.round(max / 2), max])]
  const step     = Math.ceil(n / 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="an-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.00" />
        </linearGradient>
      </defs>
      {yTicks.map(v => {
        const y = PT + cH - (v / max) * cH
        const label = v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M`
                    : v >= 1_000     ? `$${(v/1_000).toFixed(0)}k`
                    : v === 0        ? '$0' : `$${v}`
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} fill="rgba(255,255,255,0.3)"
              fontSize="10" textAnchor="end">{label}</text>
          </g>
        )
      })}
      <polygon points={area} fill="url(#an-line-fill)" />
      <polyline points={polyline} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#fff" />
      ))}
      {labels.filter((_, i) => i % step === 0).map((lbl, j) => {
        const idx = j * step
        if (!pts[idx]) return null
        return (
          <text key={lbl} x={pts[idx].x} y={H - 6}
            fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle">{lbl}</text>
        )
      })}
    </svg>
  )
}

// ── SVG: Bar chart ────────────────────────────────────────────────────────────

function BarChart({ data, labels }) {
  const W = 500, H = 200, PL = 42, PR = 12, PT = 16, PB = 30
  const cW  = W - PL - PR
  const cH  = H - PT - PB
  const max = Math.max(...data, 1)
  const n   = data.length
  const gap = 5
  const barW = cW / n - gap
  const yTicks = [...new Set([0, Math.round(max / 2), max])]
  const step   = Math.ceil(n / 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}>
      {yTicks.map(v => {
        const y = PT + cH - (v / max) * cH
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} fill="rgba(255,255,255,0.3)"
              fontSize="10" textAnchor="end">{fmtNum(v)}</text>
          </g>
        )
      })}
      {data.map((v, i) => {
        const x  = PL + i * (barW + gap)
        const bH = Math.max((v / max) * cH, v > 0 ? 2 : 0)
        const y  = PT + cH - bH
        return (
          <rect key={i} x={x} y={y} width={barW} height={bH}
            fill={i === n - 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.22)'} rx="2" />
        )
      })}
      {labels.filter((_, i) => i % step === 0).map((lbl, j) => {
        const idx = j * step
        const x = PL + idx * (barW + gap) + barW / 2
        return (
          <text key={lbl} x={x} y={H - 6}
            fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="middle">{lbl}</text>
        )
      })}
    </svg>
  )
}

// ── SVG: Donut chart ──────────────────────────────────────────────────────────

function polarToXY(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutArc(cx, cy, outerR, innerR, startDeg, endDeg) {
  const span = endDeg - startDeg
  if (span >= 359.9) {
    return [
      `M${cx - outerR} ${cy}`,
      `A${outerR} ${outerR} 0 1 1 ${cx + outerR} ${cy}`,
      `A${outerR} ${outerR} 0 1 1 ${cx - outerR} ${cy}`,
      `L${cx - innerR} ${cy}`,
      `A${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy}`,
      `A${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy}`,
      'Z',
    ].join(' ')
  }
  const s1 = polarToXY(cx, cy, outerR, startDeg)
  const e1 = polarToXY(cx, cy, outerR, endDeg)
  const s2 = polarToXY(cx, cy, innerR, endDeg)
  const e2 = polarToXY(cx, cy, innerR, startDeg)
  const lg = span > 180 ? 1 : 0
  return [
    `M${s1.x} ${s1.y}`,
    `A${outerR} ${outerR} 0 ${lg} 1 ${e1.x} ${e1.y}`,
    `L${s2.x} ${s2.y}`,
    `A${innerR} ${innerR} 0 ${lg} 0 ${e2.x} ${e2.y}`,
    'Z',
  ].join(' ')
}

const DONUT_COLORS = [
  'rgba(255,255,255,0.92)',
  'rgba(255,255,255,0.45)',
  'rgba(255,255,255,0.22)',
  'rgba(255,255,255,0.10)',
  'rgba(255,255,255,0.05)',
]

function DonutChart({ segments, total, centerLabel }) {
  const cx = 72, cy = 72, outerR = 56, innerR = 38
  const size = 144

  if (total === 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={outerR - innerR} />
        <text x={cx} y={cy - 4} fill="rgba(255,255,255,0.25)" fontSize="10" textAnchor="middle">No</text>
        <text x={cx} y={cy + 10} fill="rgba(255,255,255,0.25)" fontSize="10" textAnchor="middle">data</text>
      </svg>
    )
  }

  let cursor = 0
  const arcs = segments.map((seg, i) => {
    const sweep  = (seg.count / total) * 360
    const start  = cursor
    const end    = cursor + sweep - (sweep > 2 ? 1 : 0)
    cursor      += sweep
    return { ...seg, start, end, color: DONUT_COLORS[i] ?? DONUT_COLORS[DONUT_COLORS.length - 1] }
  })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, flexShrink: 0 }}>
      {arcs.map((arc, i) => (
        <path key={i} d={donutArc(cx, cy, outerR, innerR, arc.start, arc.end)} fill={arc.color} />
      ))}
      <text x={cx} y={cy - 6} fill="#fff" fontSize="17" fontWeight="700" textAnchor="middle"
        fontFamily="inherit">{fmtNum(total)}</text>
      <text x={cx} y={cy + 9} fill="rgba(255,255,255,0.35)" fontSize="8.5" textAnchor="middle"
        fontFamily="inherit" letterSpacing="0.06em">{centerLabel ?? 'TOTAL'}</text>
    </svg>
  )
}

// ── SVG: Mini sparkline ───────────────────────────────────────────────────────

function MiniSparkline({ seed = 0 }) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const noise = Math.sin(seed * 7 + i * 2.3) * 0.3
    return Math.max(0.1, Math.min(1, 0.3 + (i / 7) * 0.5 + noise))
  })
  const W = 52, H = 22
  const points = pts.map((v, i) => `${(i / 7) * W},${H - v * H}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IcoRevenue    = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><polyline points="1,10 5,6 8,8 13,2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoCalendar   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x=".5" y="1.5" width="13" height="12" rx="1.5"/><line x1=".5" y1="5.5" x2="13.5" y2="5.5"/><line x1="4" y1="0" x2="4" y2="3" strokeLinecap="round"/><line x1="10" y1="0" x2="10" y2="3" strokeLinecap="round"/></svg>
const IcoTicket     = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1 5a1 1 0 0 0 0 4V11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0 0-4V3a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2Z"/><line x1="5" y1="2" x2="5" y2="12" strokeDasharray="1 2"/></svg>
const IcoAttendance = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 7.5l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoDownload   = () => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 1v8M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 10v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round"/></svg>
const IcoCaret      = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>

// ── Period selector ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: 3,  label: 'Last 3 months' },
  { value: 6,  label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
]

function PeriodDropdown({ period, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const current = PERIOD_OPTIONS.find(o => o.value === period) ?? PERIOD_OPTIONS[2]

  return (
    <div className="adm-an-period-wrap" ref={ref}>
      <button
        className="adm-btn-secondary adm-an-period-btn"
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.label}
        <IcoCaret />
      </button>
      {open && (
        <ul className="adm-an-period-menu" role="listbox" aria-label="Select period">
          {PERIOD_OPTIONS.map(opt => (
            <li
              key={opt.value}
              className={`adm-an-period-item${opt.value === period ? ' adm-an-period-item--active' : ''}`}
              role="option"
              aria-selected={opt.value === period}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [events,  setEvents]  = useState([])
  const [users,   setUsers]   = useState([])
  const [period,  setPeriod]  = useState(12)

  useEffect(() => {
    let evFailed = false, usFailed = false
    Promise.all([
      adminApi.listEvents().then(r => Array.isArray(r.data) ? r.data : []).catch(() => { evFailed = true; return [] }),
      adminApi.listUsers().then(r  => Array.isArray(r.data) ? r.data  : []).catch(() => { usFailed = true; return [] }),
    ])
      .then(([eventsData, usersData]) => {
        if (evFailed && usFailed) { setError(true); return }
        setEvents(eventsData)
        setUsers(usersData)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // ── computed ────────────────────────────────────────────────────────────────

  const months = useMemo(() => getLastNMonths(period), [period])

  const usersMap = useMemo(() => {
    const m = new Map()
    users.forEach(u => m.set(u.id, u))
    return m
  }, [users])

  // All-time KPI values (not affected by period filter)
  const kpis = useMemo(() => {
    const totalRevenue = events.reduce((s, e) => s + parseFloat(e.total_revenue ?? 0), 0)
    const totalReg     = events.reduce((s, e) => s + (e.total_registrations ?? 0), 0)
    const published    = events.filter(e => e.status === 'published')
    const withCap      = published.filter(e => e.capacity > 0)
    const avgFill      = withCap.length > 0
      ? Math.round(withCap.reduce((s, e) =>
          s + Math.min(100, ((e.total_registrations ?? 0) / e.capacity) * 100), 0) / withCap.length)
      : null
    return { totalRevenue, totalReg, eventsHosted: events.length, avgFill, withCap: withCap.length }
  }, [events])

  // Revenue by month for selected period (sum total_revenue of events created that month)
  const revenueByMonth = useMemo(
    () => months.map(m =>
      events
        .filter(e => e.created_at?.slice(0, 7) === m.key)
        .reduce((s, e) => s + parseFloat(e.total_revenue ?? 0), 0)
    ),
    [months, events]
  )

  // Registrations by month for selected period
  const regByMonth = useMemo(
    () => months.map(m =>
      events
        .filter(e => e.created_at?.slice(0, 7) === m.key)
        .reduce((s, e) => s + (e.total_registrations ?? 0), 0)
    ),
    [months, events]
  )

  const chartLabels = useMemo(() => months.map(m => m.label), [months])

  // Event status distribution (donut) — all time
  const statusSegments = useMemo(() => {
    const counts = {
      published: events.filter(e => e.status === 'published').length,
      draft:     events.filter(e => e.status === 'draft').length,
      cancelled: events.filter(e => e.status === 'cancelled').length,
      closed:    events.filter(e => e.status === 'closed').length,
    }
    return [
      { label: 'Published', count: counts.published },
      { label: 'Draft',     count: counts.draft },
      { label: 'Cancelled', count: counts.cancelled },
      { label: 'Closed',    count: counts.closed },
    ].filter(s => s.count > 0)
  }, [events])

  // Top organizers by all-time revenue
  const topOrganizers = useMemo(() => {
    const map = new Map()
    events.forEach(e => {
      const id = e.owner_id
      if (!map.has(id)) {
        const user = usersMap.get(id)
        map.set(id, {
          id,
          name: user
            ? `${user.first_name} ${user.last_name}`
            : (e.owner_email?.split('@')[0] ?? `#${id}`),
          initials: user
            ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
            : (e.owner_email?.slice(0, 2) ?? '??').toUpperCase(),
          events:  0,
          revenue: 0,
        })
      }
      const org = map.get(id)
      org.events++
      org.revenue += parseFloat(e.total_revenue ?? 0)
    })
    return [...map.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [events, usersMap])

  // ── guards ──────────────────────────────────────────────────────────────────

  if (loading) return <div className="ed-state">Loading…</div>
  if (error)   return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">500</p>
      <p className="ed-state-msg">Failed to load analytics data.</p>
    </div>
  )

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="adm-wrap">

      {/* header */}
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Platform analytics</h1>
          <p className="adm-sub">Every event, every organizer — in one place.</p>
        </div>
        <div className="adm-header-actions">
          <button
            className="adm-btn-secondary"
            onClick={() => exportCSV(events, users)}
            disabled={events.length === 0 && users.length === 0}
            type="button"
          >
            <IcoDownload /> Export CSV
          </button>
          <PeriodDropdown period={period} onChange={setPeriod} />
        </div>
      </div>

      {/* KPI cards — all-time platform totals */}
      <div className="adm-stat-grid">
        <div className="adm-stat-card">
          <div className="adm-stat-top">
            <span className="adm-stat-label">GROSS REVENUE</span>
            <span className="adm-stat-icon"><IcoRevenue /></span>
          </div>
          <span className="adm-stat-value">
            {kpis.totalRevenue > 0 ? fmtRevenue(kpis.totalRevenue) : '—'}
          </span>
          <span className="adm-stat-sub">
            {kpis.totalRevenue > 0 ? 'From confirmed paid registrations' : 'No revenue recorded yet'}
          </span>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-top">
            <span className="adm-stat-label">EVENTS HOSTED</span>
            <span className="adm-stat-icon"><IcoCalendar /></span>
          </div>
          <span className="adm-stat-value">{fmtNum(kpis.eventsHosted)}</span>
          <span className="adm-stat-sub">
            {events.filter(e => e.status === 'published').length} published ·{' '}
            {events.filter(e => e.status === 'draft').length} draft
          </span>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-top">
            <span className="adm-stat-label">REGISTRATIONS</span>
            <span className="adm-stat-icon"><IcoTicket /></span>
          </div>
          <span className="adm-stat-value">
            {kpis.totalReg > 0 ? fmtNum(kpis.totalReg) : '—'}
          </span>
          <span className="adm-stat-sub">
            {kpis.totalReg > 0 ? 'Across all events' : 'No registration data yet'}
          </span>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-top">
            <span className="adm-stat-label">AVG. FILL RATE</span>
            <span className="adm-stat-icon"><IcoAttendance /></span>
          </div>
          <span className="adm-stat-value">
            {kpis.avgFill != null ? `${kpis.avgFill}%` : '—'}
          </span>
          <span className="adm-stat-sub">
            {kpis.avgFill != null
              ? `Avg across ${kpis.withCap} events with capacity`
              : 'No capacity data available'}
          </span>
        </div>
      </div>

      {/* row 1: revenue line chart + event status donut */}
      <div className="adm-an-split">
        <div className="adm-chart-box adm-an-chart-card">
          <p className="adm-chart-title">Revenue across all events</p>
          <p className="adm-chart-sub">
            Monthly · by event creation date · {PERIOD_OPTIONS.find(o => o.value === period)?.label}
          </p>
          <div className="adm-an-chart-area">
            {events.length === 0
              ? <p className="adm-an-empty">No event data available.</p>
              : <LineChart data={revenueByMonth} labels={chartLabels} />}
          </div>
        </div>

        <div className="adm-chart-box adm-an-donut-card">
          <p className="adm-chart-title">Event distribution</p>
          <p className="adm-chart-sub">By status · all time</p>
          <div className="adm-an-donut-wrap">
            {events.length === 0 ? (
              <p className="adm-an-empty">No events yet.</p>
            ) : (
              <>
                <DonutChart
                  segments={statusSegments}
                  total={kpis.eventsHosted}
                  centerLabel="EVENTS"
                />
                <ul className="adm-an-legend">
                  {statusSegments.map((seg, i) => {
                    const pct = kpis.eventsHosted > 0
                      ? Math.round((seg.count / kpis.eventsHosted) * 100) : 0
                    return (
                      <li key={seg.label} className="adm-an-legend-row">
                        <span
                          className="adm-an-legend-dot"
                          style={{ background: DONUT_COLORS[i] ?? DONUT_COLORS[DONUT_COLORS.length - 1] }}
                        />
                        <span className="adm-an-legend-label">{seg.label}</span>
                        <span className="adm-an-legend-pct">{pct}%</span>
                        <span className="adm-an-legend-count">{seg.count.toLocaleString()}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {/* row 2: registration bar chart + top organizers */}
      <div className="adm-an-split">
        <div className="adm-chart-box adm-an-chart-card">
          <p className="adm-chart-title">Registration trends</p>
          <p className="adm-chart-sub">
            By event creation month · {PERIOD_OPTIONS.find(o => o.value === period)?.label}
          </p>
          <div className="adm-an-chart-area">
            {events.length === 0
              ? <p className="adm-an-empty">No event data available.</p>
              : <BarChart data={regByMonth} labels={chartLabels} />}
          </div>
        </div>

        <div className="adm-chart-box adm-an-org-card">
          <p className="adm-chart-title">Top organizers</p>
          <p className="adm-chart-sub">Ranked by revenue · all time</p>
          {topOrganizers.length === 0 ? (
            <p className="adm-an-empty">No organizer data available.</p>
          ) : (
            <ol className="adm-an-org-list">
              {topOrganizers.map((org, i) => (
                <li key={org.id} className="adm-an-org-row">
                  <span className="adm-an-org-rank">{i + 1}</span>
                  <span className="adm-an-org-avatar">{org.initials}</span>
                  <div className="adm-an-org-info">
                    <span className="adm-an-org-name">{org.name}</span>
                    <span className="adm-an-org-meta">
                      {org.events} event{org.events !== 1 ? 's' : ''}
                      {org.revenue > 0 ? ` · ${fmtRevenue(org.revenue)}` : ''}
                    </span>
                  </div>
                  <MiniSparkline seed={org.id} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

    </div>
  )
}
