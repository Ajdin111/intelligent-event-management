import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authApi, eventsApi, ticketTiersApi, reviewsApi, organizerApi } from '../../services/api'

// ── helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Group registrations into last 12 weekly buckets, return cumulative counts
function buildWeeklyChart(registrations) {
  const now = Date.now()
  const MS_WEEK = 7 * 24 * 3600 * 1000
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    label: `W${i + 1}`,
    start: now - (11 - i) * MS_WEEK,
    end:   now - (10 - i) * MS_WEEK,
    count: 0,
  }))
  buckets[11].end = now + 1 // include today

  for (const reg of registrations) {
    const t = new Date(reg.registered_at).getTime()
    for (const b of buckets) {
      if (t >= b.start && t < b.end) { b.count++; break }
    }
  }

  let cum = 0
  return buckets.map(b => { cum += b.count; return { label: b.label, value: cum } })
}

// ── SVG line chart ─────────────────────────────────────────────────────────

function LineChart({ data }) {
  const W = 760, H = 160, PX = 0, PY = 16
  const vals = data.map(d => d.value)
  const max  = Math.max(...vals, 1)
  const pts  = data.map((d, i) => ({
    x: PX + (i / (data.length - 1)) * (W - PX * 2),
    y: PY + (1 - d.value / max) * (H - PY * 2),
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`
  const ticks    = [0.25, 0.5, 0.75, 1]

  return (
    <div className="oa-chart-svg-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="white" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {ticks.map(t => (
          <line key={t}
            x1={PX} y1={PY + (1 - t) * (H - PY * 2)}
            x2={W}  y2={PY + (1 - t) * (H - PY * 2)}
            stroke="rgba(255,255,255,0.07)" strokeWidth="1"
          />
        ))}
        <path d={areaPath} fill="url(#lineGrad)" />
        <path d={linePath} fill="none" stroke="white" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5"
            fill="var(--bg-card)" stroke="white" strokeWidth="1.8" />
        ))}
      </svg>
      <div className="oa-chart-x-labels">
        {data.map((d, i) => (
          i % 2 === 0 ? <span key={i}>{d.label}</span> : <span key={i} />
        ))}
      </div>
      <div className="oa-chart-y-labels">
        {ticks.slice().reverse().map(t => (
          <span key={t}>{Math.round(t * Math.max(...vals, 1))}</span>
        ))}
        <span>0</span>
      </div>
    </div>
  )
}

// ── SVG donut chart ────────────────────────────────────────────────────────

const DONUT_COLORS = ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.12)']

function DonutChart({ segments, total }) {
  const R    = 58
  const CX   = 76
  const CY   = 76
  const circ = 2 * Math.PI * R
  const GAP  = segments.length > 1 ? 3 : 0

  let cumLen = 0
  const segs = segments.map((seg, i) => {
    const segLen  = Math.max((seg.pct / 100) * circ - GAP, 0)
    const offset  = circ / 4 - cumLen
    cumLen += (seg.pct / 100) * circ
    return { ...seg, segLen, offset, color: DONUT_COLORS[i % DONUT_COLORS.length] }
  })

  return (
    <svg viewBox="0 0 152 152" width="152" height="152" style={{ flexShrink: 0 }}>
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="20" />
      {segs.map((s, i) => (
        <circle key={i} cx={CX} cy={CY} r={R} fill="none"
          stroke={s.color} strokeWidth="20"
          strokeDasharray={`${s.segLen} ${circ - s.segLen}`}
          strokeDashoffset={s.offset}
          strokeLinecap="butt"
        />
      ))}
      <text x={CX} y={CY - 7} textAnchor="middle"
        fill="white" fontSize="18" fontWeight="700" fontFamily="inherit">
        {total}
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle"
        fill="rgba(255,255,255,0.4)" fontSize="8.5" letterSpacing="1" fontFamily="inherit">
        TOTAL
      </text>
    </svg>
  )
}

// ── main component ─────────────────────────────────────────────────────────

export default function OrganizerAnalytics() {
  const { eventId: eventIdParam } = useParams()
  const navigate = useNavigate()

  const [myEvents, setMyEvents]       = useState([])
  const [activeEventId, setActiveEventId] = useState(null)
  const [registrations, setRegistrations] = useState([])
  const [tiers, setTiers]             = useState([])
  const [reviews, setReviews]         = useState([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [notFound, setNotFound]       = useState(false)
  const [fetchError, setFetchError]   = useState('')

  // ── step 1: load user + events ──
  useEffect(() => {
    Promise.all([
      authApi.me(),
      eventsApi.list({ limit: 100 }),
    ])
      .then(([userRes, eventsRes]) => {
        const uid   = userRes.data.id
        const items = eventsRes.data?.items ?? eventsRes.data ?? []
        const owned = items.filter(e => e.owner_id === uid)
        setMyEvents(owned)

        if (owned.length === 0) { setLoadingInit(false); return }

        const targetId = eventIdParam ? Number(eventIdParam) : null
        if (targetId) {
          const match = owned.find(e => e.id === targetId)
          if (!match || isNaN(targetId)) { setNotFound(true); setLoadingInit(false); return }
          setActiveEventId(targetId)
        } else {
          // no param → redirect to first event
          navigate(`/organizer/analytics/${owned[0].id}`, { replace: true })
        }
      })
      .catch(() => setFetchError('Failed to load events.'))
      .finally(() => setLoadingInit(false))
  }, [])

  // ── step 2: when active event changes, load its stats ──
  useEffect(() => {
    if (!activeEventId) return
    setLoadingStats(true)
    setRegistrations([])
    setTiers([])
    setReviews([])

    Promise.all([
      organizerApi.listEventRegistrations(activeEventId, { limit: 100 }).then(r => r.data?.items ?? []),
      ticketTiersApi.listByEvent(activeEventId).then(r => r.data),
      reviewsApi.listByEvent(activeEventId).then(r => r.data).catch(() => []),
    ])
      .then(([regs, tierData, reviewData]) => {
        setRegistrations(Array.isArray(regs) ? regs : [])
        setTiers(Array.isArray(tierData) ? tierData : [])
        setReviews(Array.isArray(reviewData) ? reviewData : [])
      })
      .catch(() => setFetchError('Failed to load analytics data.'))
      .finally(() => setLoadingStats(false))
  }, [activeEventId])

  // ── sync URL param changes ──
  useEffect(() => {
    if (!eventIdParam || myEvents.length === 0) return
    const numId = Number(eventIdParam)
    if (isNaN(numId) || numId <= 0) { setNotFound(true); return }
    const match = myEvents.find(e => e.id === numId)
    if (!match) { setNotFound(true); return }
    setNotFound(false)
    setActiveEventId(numId)
  }, [eventIdParam, myEvents])

  // ── computed stats ──
  const confirmedRegs = useMemo(() => registrations.filter(r => r.status === 'confirmed'), [registrations])
  const totalRevenue  = useMemo(() => confirmedRegs.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0), [confirmedRegs])
  const avgRating     = useMemo(() => reviews.length > 0
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
    : null, [reviews])

  const weeklyData = useMemo(() => buildWeeklyChart(registrations), [registrations])

  const tierSegments = useMemo(() => {
    const totalSold = tiers.reduce((s, t) => s + t.quantity_sold, 0)
    if (totalSold === 0) return []
    return tiers
      .filter(t => t.quantity_sold > 0)
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .map(t => ({
        name:  t.name,
        count: t.quantity_sold,
        pct:   Math.round(t.quantity_sold / totalSold * 100),
      }))
  }, [tiers])

  const totalTicketsSold = useMemo(() => tiers.reduce((s, t) => s + t.quantity_sold, 0), [tiers])

  const sentiment = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 }
    for (const r of reviews) {
      if (r.sentiment && counts[r.sentiment] !== undefined) counts[r.sentiment]++
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    return total > 0 ? {
      positive: Math.round(counts.positive / total * 100),
      neutral:  Math.round(counts.neutral  / total * 100),
      negative: Math.round(counts.negative / total * 100),
      total,
    } : null
  }, [reviews])

  const activeEvent = useMemo(() => myEvents.find(e => e.id === activeEventId) ?? null, [myEvents, activeEventId])

  const handleEventChange = (e) => {
    const id = Number(e.target.value)
    navigate(`/organizer/analytics/${id}`)
  }

  const handleExport = () => window.print()

  // ── guard states ──
  if (loadingInit) return <div className="ed-state">Loading…</div>

  if (fetchError) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-msg">{fetchError}</p>
      <button className="reg-btn-secondary" style={{ marginTop: 16, maxWidth: 200 }}
        onClick={() => window.location.reload()}>Retry</button>
    </div>
  )

  if (notFound) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">404</p>
      <p className="ed-state-msg">Event not found</p>
      <button className="reg-btn-secondary" style={{ marginTop: 20, maxWidth: 220 }}
        onClick={() => {
          if (myEvents.length > 0) {
            setNotFound(false)
            navigate(`/organizer/analytics/${myEvents[0].id}`)
          } else {
            navigate('/organizer/dashboard')
          }
        }}>
        Back to analytics
      </button>
    </div>
  )

  if (myEvents.length === 0) return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-msg">You have no events yet.</p>
      <button className="reg-btn-primary" style={{ marginTop: 16, maxWidth: 200 }}
        onClick={() => navigate('/organizer/create-event')}>Create event</button>
    </div>
  )

  // ── render ──
  return (
    <div className="oa-wrap">

      {/* header */}
      <div className="oa-header">
        <div>
          <h1 className="oa-heading">Event analytics</h1>
          {activeEvent && (
            <p className="oa-subheading">
              {activeEvent.title} · performance to date
            </p>
          )}
        </div>
        <div className="oa-header-actions">
          <button className="oa-export-btn" onClick={handleExport}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6.5 1v7M4 6l2.5 2.5L9 6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 10v1a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" strokeLinecap="round" />
            </svg>
            Export PDF
          </button>
          <select className="oa-event-select" value={activeEventId ?? ''} onChange={handleEventChange}>
            {myEvents.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
      </div>

      {loadingStats ? (
        <div className="ed-state" style={{ height: 200 }}>Loading data…</div>
      ) : (
        <>
          {/* stat cards */}
          <div className="oa-stat-grid">
            <div className="oa-stat-card">
              <div className="oa-stat-top">
                <span className="oa-stat-label">REGISTRATIONS</span>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".4">
                  <circle cx="5" cy="5" r="3" /><path d="M1 13c0-3 2-4.5 4-4.5s4 1.5 4 4.5" strokeLinecap="round" />
                  <circle cx="11" cy="4.5" r="2.2" /><path d="M13 12c0-2-1.2-3.5-2-3.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="oa-stat-value">{registrations.length.toLocaleString()}</p>
              <p className="oa-stat-sub">
                {confirmedRegs.length} confirmed · {registrations.filter(r => r.status === 'cancelled').length} cancelled
              </p>
            </div>

            <div className="oa-stat-card">
              <div className="oa-stat-top">
                <span className="oa-stat-label">REVENUE</span>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".4">
                  <path d="M2 12L7 4l3 4 2-2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="oa-stat-value">{fmtCurrency(totalRevenue)}</p>
              <p className="oa-stat-sub">From {confirmedRegs.length} confirmed registrations</p>
            </div>

            <div className="oa-stat-card">
              <div className="oa-stat-top">
                <span className="oa-stat-label">TICKETS SOLD</span>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".4">
                  <path d="M1 5a1 1 0 0 0 0 4v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1a1 1 0 0 0 0-4V4a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v1Z" />
                </svg>
              </div>
              <p className="oa-stat-value">{totalTicketsSold.toLocaleString()}</p>
              <p className="oa-stat-sub">Across {tiers.length} tier{tiers.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="oa-stat-card">
              <div className="oa-stat-top">
                <span className="oa-stat-label">AVG. RATING</span>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".4">
                  <path d="M7 1l1.5 3 3 .5-2.2 2.2.5 3.3L7 8.5l-2.8 1.5.5-3.3L2.5 4.5l3-.5z" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="oa-stat-value">
                {avgRating !== null ? `${avgRating} ★` : '—'}
              </p>
              <p className="oa-stat-sub">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* charts row 1 */}
          <div className="oa-charts-row">

            {/* registrations over time */}
            <div className="oa-chart-box oa-chart-box--wide">
              <div className="oa-chart-header">
                <div>
                  <p className="oa-chart-title">Registrations over time</p>
                  <p className="oa-chart-sub">Cumulative · last 12 weeks</p>
                </div>
              </div>
              {registrations.length === 0 ? (
                <div className="oa-chart-empty">No registration data yet</div>
              ) : (
                <LineChart data={weeklyData} />
              )}
            </div>

            {/* ticket tier breakdown */}
            <div className="oa-chart-box">
              <div className="oa-chart-header">
                <p className="oa-chart-title">Ticket tier breakdown</p>
              </div>
              {tierSegments.length === 0 ? (
                <div className="oa-chart-empty">No tickets sold yet</div>
              ) : (
                <div className="oa-tier-breakdown">
                  <DonutChart segments={tierSegments} total={totalTicketsSold} />
                  <div className="oa-tier-legend">
                    {tierSegments.map((seg, i) => (
                      <div key={i} className="oa-tier-legend-row">
                        <span className="oa-tier-legend-dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="oa-tier-legend-name">{seg.name}</span>
                        <span className="oa-tier-legend-pct">{seg.pct}%</span>
                        <span className="oa-tier-legend-count">{seg.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* charts row 2 */}
          <div className="oa-charts-row">

            {/* registration status breakdown */}
            <div className="oa-chart-box">
              <div className="oa-chart-header">
                <p className="oa-chart-title">Registration status</p>
                <p className="oa-chart-sub">By confirmation state</p>
              </div>
              {registrations.length === 0 ? (
                <div className="oa-chart-empty">No data yet</div>
              ) : (
                <div className="oa-status-bars">
                  {[
                    { label: 'Confirmed', status: 'confirmed', color: '#4ade80' },
                    { label: 'Pending',   status: 'pending',   color: '#fbbf24' },
                    { label: 'Cancelled', status: 'cancelled', color: '#f87171' },
                    { label: 'Rejected',  status: 'rejected',  color: '#ef4444' },
                  ].map(({ label, status, color }) => {
                    const count = registrations.filter(r => r.status === status).length
                    const pct   = registrations.length > 0 ? count / registrations.length * 100 : 0
                    return (
                      <div key={status} className="oa-status-bar-row">
                        <span className="oa-status-bar-label">{label}</span>
                        <div className="oa-status-bar-track">
                          <div className="oa-status-bar-fill"
                            style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="oa-status-bar-count">{count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* feedback sentiment */}
            <div className="oa-chart-box">
              <div className="oa-chart-header">
                <div>
                  <p className="oa-chart-title">
                    Feedback sentiment
                    <span className="oa-ai-badge">AI</span>
                  </p>
                  <p className="oa-chart-sub">
                    Aggregated across {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="oa-chart-empty">No review data yet</div>
              ) : (
                <>
                  {/* sentiment bars — only shown when AI sentiment field is populated */}
                  {sentiment && (
                    <>
                      <div className="oa-sentiment-track">
                        <div className="oa-sentiment-fill oa-sentiment-fill--pos"
                          style={{ width: `${sentiment.positive}%` }} />
                        <div className="oa-sentiment-fill oa-sentiment-fill--neu"
                          style={{ width: `${sentiment.neutral}%` }} />
                        <div className="oa-sentiment-fill oa-sentiment-fill--neg"
                          style={{ width: `${sentiment.negative}%` }} />
                      </div>
                      <div className="oa-sentiment-labels">
                        <span className="oa-sentiment-pos">{sentiment.positive}% positive</span>
                        <span className="oa-sentiment-neu">{sentiment.neutral}% neutral</span>
                        <span className="oa-sentiment-neg">{sentiment.negative}% negative</span>
                      </div>
                    </>
                  )}

                  {/* star distribution — always shown when reviews exist */}
                  <div className="oa-star-dist">
                    {[5,4,3,2,1].map(star => {
                      const cnt = reviews.filter(r => r.rating === star).length
                      const pct = cnt / reviews.length * 100
                      return (
                        <div key={star} className="oa-star-row">
                          <span className="oa-star-label">{star}</span>
                          <div className="oa-star-track">
                            <div className="oa-star-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="oa-star-pct">{Math.round(pct)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

          </div>

          {/* event info footer */}
          {activeEvent && (
            <div className="oa-event-meta">
              <span>
                <strong>{activeEvent.title}</strong>
                {activeEvent.start_datetime && ` · ${fmtDate(activeEvent.start_datetime)}`}
                {activeEvent.physical_address && ` · ${activeEvent.physical_address}`}
                {activeEvent.location_type === 'online' && !activeEvent.physical_address && ' · Remote'}
              </span>
              <span className={`oa-event-status oa-event-status--${activeEvent.status}`}>
                {activeEvent.status}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
