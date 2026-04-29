import { useState, useEffect } from 'react'
import { registrationsApi, eventsApi } from '../services/api'

// ── QR Code ──────────────────────────────────────────────────────────────────
// Uses a free QR API to render the ticket's qr_code string as an image.
// In production you can swap this for: import { QRCodeSVG } from 'qrcode.react'
// and render <QRCodeSVG value={value} size={124} bgColor="#ffffff" fgColor="#000000" />
// after running: npm install qrcode.react

function QRCode({ value }) {
  const [failed, setFailed] = useState(false)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=000000&margin=4`

  if (failed) {
    // Offline fallback: decorative SVG that looks like a QR
    return (
      <div className="ticket-qr-inner">
        <svg width="124" height="124" viewBox="0 0 124 124" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="124" height="124" fill="white"/>
          {/* top-left finder */}
          <rect x="8" y="8" width="36" height="36" fill="black"/>
          <rect x="13" y="13" width="26" height="26" fill="white"/>
          <rect x="18" y="18" width="16" height="16" fill="black"/>
          {/* top-right finder */}
          <rect x="80" y="8" width="36" height="36" fill="black"/>
          <rect x="85" y="13" width="26" height="26" fill="white"/>
          <rect x="90" y="18" width="16" height="16" fill="black"/>
          {/* bottom-left finder */}
          <rect x="8" y="80" width="36" height="36" fill="black"/>
          <rect x="13" y="85" width="26" height="26" fill="white"/>
          <rect x="18" y="90" width="16" height="16" fill="black"/>
          {/* timing + data dots */}
          <rect x="52" y="8" width="6" height="6" fill="black"/>
          <rect x="52" y="20" width="6" height="6" fill="black"/>
          <rect x="52" y="32" width="6" height="6" fill="black"/>
          <rect x="8" y="52" width="6" height="6" fill="black"/>
          <rect x="20" y="52" width="6" height="6" fill="black"/>
          <rect x="32" y="52" width="6" height="6" fill="black"/>
          <rect x="52" y="52" width="6" height="6" fill="black"/>
          <rect x="64" y="52" width="6" height="6" fill="black"/>
          <rect x="76" y="52" width="6" height="6" fill="black"/>
          <rect x="88" y="52" width="6" height="6" fill="black"/>
          <rect x="100" y="52" width="6" height="6" fill="black"/>
          <rect x="64" y="64" width="6" height="6" fill="black"/>
          <rect x="76" y="76" width="6" height="6" fill="black"/>
          <rect x="88" y="64" width="6" height="6" fill="black"/>
          <rect x="100" y="76" width="6" height="6" fill="black"/>
          <rect x="64" y="88" width="6" height="6" fill="black"/>
          <rect x="88" y="88" width="6" height="6" fill="black"/>
          <rect x="100" y="64" width="6" height="6" fill="black"/>
          <rect x="76" y="100" width="6" height="6" fill="black"/>
          <rect x="64" y="100" width="6" height="6" fill="black"/>
        </svg>
      </div>
    )
  }

  return (
    <div className="ticket-qr-inner">
      <img
        src={src}
        alt="QR Code"
        width={124}
        height={124}
        style={{ display: 'block', imageRendering: 'pixelated' }}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

const IcoDownload = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="6.5" y1="1" x2="6.5" y2="9" strokeLinecap="round" />
    <path d="M3 6.5l3.5 3 3.5-3" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="1" y1="12" x2="12" y2="12" strokeLinecap="round" />
  </svg>
)

const IcoCal = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="0.5" y="1.5" width="11" height="10" rx="1.2" />
    <line x1="0.5" y1="4.5" x2="11.5" y2="4.5" />
    <line x1="3.5" y1="0" x2="3.5" y2="3" strokeLinecap="round" />
    <line x1="8.5" y1="0" x2="8.5" y2="3" strokeLinecap="round" />
  </svg>
)

const IcoPin = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3Z" strokeLinejoin="round" />
    <circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

const IcoEmpty = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.2">
    <rect x="2" y="8" width="36" height="28" rx="3" />
    <line x1="2" y1="16" x2="38" y2="16" />
    <line x1="10" y1="4" x2="10" y2="12" strokeLinecap="round" />
    <line x1="30" y1="4" x2="30" y2="12" strokeLinecap="round" />
  </svg>
)

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTimeRange(startIso, endIso) {
  if (!startIso) return ''
  const fmt = (iso) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  return endIso ? `${fmt(startIso)}–${fmt(endIso)}` : fmt(startIso)
}

function getLocation(event) {
  if (!event) return '—'
  if (event.location_type === 'online') return 'Online'
  return event.physical_address || '—'
}

// ── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, registration, event, index }) {
  const regNumber = `#R${index + 1}`

  // Category derived from event (we don't have the category name here,
  // so we use the first category_id or location_type as a label)
  const categoryLabel = event?.location_type === 'online' ? 'ONLINE' : 'EVENT'

  // Tier name: the registration has ticket_tier_id — we just show a friendly label
  // The actual tier name would require a separate API call; we use a stored prop
  const tierName = registration?._tierName ?? 'Standard'

  const location = getLocation(event)
  const dateStr  = formatDate(event?.start_datetime)
  const timeStr  = formatTimeRange(event?.start_datetime, event?.end_datetime)
  const title    = event?.title ?? `Event #${ticket.event_id}`

 const handleDownload = async () => {
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(ticket.qr_code)}&bgcolor=ffffff&color=000000&margin=10`
    const response = await fetch(url)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `ticket-${ticket.id}.png`
    a.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    // fallback if fetch fails
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(ticket.qr_code)}`, '_blank')
  }
}

  return (
    <div className={`ticket-card${!ticket.is_valid ? ' ticket-card--invalid' : ''}`}>
      {/* ── left: event info ── */}
      <div className="ticket-card-left">
        <div className="ticket-card-toprow">
          <span className="ticket-cat-pill">{categoryLabel}</span>
          <span className="ticket-reg-num">{regNumber}</span>
        </div>

        <h2 className="ticket-event-title">{title}</h2>

        <div className="ticket-divider" />

        <div className="ticket-meta-cols">
          {/* WHEN */}
          <div className="ticket-meta-col">
            <p className="ticket-meta-label">WHEN</p>
            <div className="ticket-meta-row">
              <IcoCal />
              <span className="ticket-meta-val">{dateStr}</span>
            </div>
            {timeStr && (
              <p className="ticket-meta-val ticket-meta-secondary">{timeStr}</p>
            )}
          </div>

          {/* WHERE */}
          <div className="ticket-meta-col">
            <p className="ticket-meta-label">WHERE</p>
            <div className="ticket-meta-row">
              <IcoPin />
              <span className="ticket-meta-val">{location}</span>
            </div>
            <p className="ticket-meta-val ticket-meta-secondary">{tierName}</p>
          </div>
        </div>

        <button className="ticket-download-btn" onClick={handleDownload}>
          <IcoDownload />
          Download
        </button>
      </div>

      {/* ── right: QR code ── */}
      <div className="ticket-card-right">
        <QRCode value={ticket.qr_code} />
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MyTickets() {
  const [items, setItems]     = useState([])  // { ticket, registration, event }[]
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // 1. Fetch all my registrations
        const regsRes = await registrationsApi.getMine()
        const registrations = regsRes.data ?? []
        const confirmed = registrations.filter(r => r.status === 'confirmed')

        if (confirmed.length === 0) {
          if (!cancelled) { setItems([]); setLoading(false) }
          return
        }

        // 2. Fetch tickets + event for each confirmed registration in parallel
        const settled = await Promise.allSettled(
          confirmed.map(async (reg) => {
            const [ticketsRes, eventRes] = await Promise.allSettled([
              registrationsApi.getTickets(reg.id),
              eventsApi.getById(reg.event_id),
            ])

            const regTickets =
              ticketsRes.status === 'fulfilled' ? (ticketsRes.value.data ?? []) : []
            const event =
              eventRes.status === 'fulfilled' ? eventRes.value.data : null

            // Attach tier name to registration object for use in card
            const enrichedReg = { ...reg, _tierName: reg.ticket_tier_id ? 'Standard' : 'General' }

            return regTickets
              .filter(t => t.is_valid)
              .map(t => ({ ticket: t, registration: enrichedReg, event }))
          })
        )

        if (cancelled) return

        const flat = settled
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value)

        setItems(flat)
      } catch {
        if (!cancelled) setError('Failed to load tickets. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <div className="ed-state">Loading tickets…</div>
  }

  if (error) {
    return (
      <div className="ed-state ed-state--center">
        <p className="ed-state-msg">{error}</p>
        <button
          className="reg-btn-secondary"
          style={{ marginTop: 16, maxWidth: 200 }}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="tickets-page">
      <div className="tickets-header">
        <div>
          <h1 className="tickets-heading">My tickets</h1>
          <p className="tickets-sub">Scan at the door or download for offline use.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="tickets-empty">
          <span className="tickets-empty-icon"><IcoEmpty /></span>
          <p className="tickets-empty-title">No tickets yet</p>
          <p className="tickets-empty-sub">
            Your confirmed registrations will appear here with a scannable QR code.
          </p>
        </div>
      ) : (
        <div className="tickets-grid">
          {items.map(({ ticket, registration, event }, i) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              registration={registration}
              event={event}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}