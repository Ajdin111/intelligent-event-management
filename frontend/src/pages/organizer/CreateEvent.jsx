import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { categoriesApi, setCriticalOp } from '../../services/api'

const STEPS = [
  { n: 1, label: 'Basic info' },
  { n: 2, label: 'Registration' },
  { n: 3, label: 'Ticket tiers' },
  { n: 4, label: 'Promo codes' },
  { n: 5, label: 'Agenda' },
]

let _tid = 0, _cid = 0, _trid = 0, _sid = 0

const newTier = () => ({
  _id: ++_tid,
  name: '',
  description: '',
  price: '0.00',
  quantity: '',
  sale_start: '',
  sale_end: '',
})

const newCode = () => ({
  _id: ++_cid,
  code: '',
  discount_type: 'percentage',
  discount_value: '10',
  max_uses: '100',
  valid_from: '',
  valid_until: '',
})

const newSession = () => ({
  _id: ++_sid,
  title: '',
  speaker_name: '',
  location: '',
  start_datetime: '',
  end_datetime: '',
})

const newTrack = () => ({
  _id: ++_trid,
  name: '',
  color: '',
  sessions: [newSession()],
})

function toNaiveDatetime(date, time) {
  if (!date || !time) return null
  return `${date}T${time}:00`
}

export default function CreateEvent() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [flash, setFlash] = useState(null)
  const [tiers, setTiers] = useState([newTier()])
  const [codes, setCodes] = useState([])
  const [tracks, setTracks] = useState([newTrack()])
  const [categories, setCategories] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    location_type: 'physical',
    physical_address: '',
    online_link: '',
    date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    capacity: '',
    registration_type: 'automatic',
    requires_registration: true,
    feedback_visibility: 'public',
  })

  useEffect(() => {
    categoriesApi.list()
      .then(res => setCategories(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 5000)
    return () => clearTimeout(t)
  }, [flash])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }


  function buildPayload() {
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      location_type: form.location_type,
      physical_address: form.physical_address.trim() || null,
      online_link: form.online_link.trim() || null,
      start_datetime: toNaiveDatetime(form.date, form.start_time),
      end_datetime: toNaiveDatetime(form.end_date, form.end_time),
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      registration_type: form.registration_type,
      requires_registration: form.requires_registration,
      has_ticketing: true,
      is_free: tiers.length > 0 && tiers.every(t => parseFloat(t.price || 0) === 0),
      feedback_visibility: form.feedback_visibility,
      category_ids: form.category_id ? [parseInt(form.category_id, 10)] : null,
    }
  }

  function validateStep1() {
    if (!form.title.trim()) {
      setFlash({ type: 'error', message: 'Event title is required.' }); return false
    }
    if (!form.description.trim()) {
      setFlash({ type: 'error', message: 'Event description is required.' }); return false
    }
    if (!form.date || !form.start_time) {
      setFlash({ type: 'error', message: 'Start date and time are required.' }); return false
    }
    if (!form.end_date || !form.end_time) {
      setFlash({ type: 'error', message: 'End date and time are required.' }); return false
    }
    if (toNaiveDatetime(form.end_date, form.end_time) <= toNaiveDatetime(form.date, form.start_time)) {
      setFlash({ type: 'error', message: 'End must be after start.' }); return false
    }
    if ((form.location_type === 'physical' || form.location_type === 'hybrid') && !form.physical_address.trim()) {
      setFlash({ type: 'error', message: 'Physical address is required for this location type.' }); return false
    }
    if ((form.location_type === 'online' || form.location_type === 'hybrid') && !form.online_link.trim()) {
      setFlash({ type: 'error', message: 'Online link is required for this location type.' }); return false
    }
    return true
  }

  function validateTiers() {
    if (tiers.length === 0) {
      setFlash({ type: 'error', message: 'At least one ticket tier is required.' }); return false
    }
    const eventStart = form.date && form.start_time ? `${form.date}T${form.start_time}` : null
    const totalQty = tiers.reduce((s, t) => s + parseInt(t.quantity || 0, 10), 0)
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i]
      const n = i + 1
      if (!t.name.trim()) {
        setFlash({ type: 'error', message: `Tier ${n}: name is required.` }); return false
      }
      if (parseFloat(t.price) < 0) {
        setFlash({ type: 'error', message: `Tier ${n}: price cannot be negative.` }); return false
      }
      if (!t.quantity || parseInt(t.quantity, 10) < 1) {
        setFlash({ type: 'error', message: `Tier ${n}: quantity must be at least 1.` }); return false
      }
      if (form.capacity && totalQty > parseInt(form.capacity, 10)) {
        setFlash({ type: 'error', message: `Total tier quantity (${totalQty}) exceeds event capacity (${form.capacity}). Reduce tier quantities or increase capacity.` }); return false
      }
      if (!t.sale_start) {
        setFlash({ type: 'error', message: `Tier ${n}: sale start date and time are required.` }); return false
      }
      if (!t.sale_end) {
        setFlash({ type: 'error', message: `Tier ${n}: sale end date and time are required.` }); return false
      }
      if (t.sale_end <= t.sale_start) {
        setFlash({ type: 'error', message: `Tier ${n}: sale end must be after sale start.` }); return false
      }
      if (eventStart && t.sale_end > eventStart) {
        setFlash({ type: 'error', message: `Tier ${n}: ticket sales must close before the event starts (${form.date}).` }); return false
      }
    }
    return true
  }

  function validateCodes() {
    const eventStart = form.date && form.start_time ? `${form.date}T${form.start_time}` : null
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i]
      const n = i + 1
      if (!c.code.trim()) {
        setFlash({ type: 'error', message: `Promo code ${n}: code string is required.` }); return false
      }
      if (!c.discount_value || parseFloat(c.discount_value) <= 0) {
        setFlash({ type: 'error', message: `Promo code ${n}: discount value must be greater than 0.` }); return false
      }
      if (c.discount_type === 'percentage' && parseFloat(c.discount_value) > 100) {
        setFlash({ type: 'error', message: `Promo code ${n}: percentage discount cannot exceed 100%.` }); return false
      }
      if (!c.max_uses || parseInt(c.max_uses, 10) < 1) {
        setFlash({ type: 'error', message: `Promo code ${n}: max uses must be at least 1.` }); return false
      }
      if (!c.valid_from) {
        setFlash({ type: 'error', message: `Promo code ${n}: valid from date is required.` }); return false
      }
      if (!c.valid_until) {
        setFlash({ type: 'error', message: `Promo code ${n}: valid until date is required.` }); return false
      }
      if (c.valid_until <= c.valid_from) {
        setFlash({ type: 'error', message: `Promo code ${n}: valid until must be after valid from.` }); return false
      }
      if (eventStart && c.valid_until > eventStart) {
        setFlash({ type: 'error', message: `Promo code ${n}: valid until must be before the event starts (${form.date} ${form.start_time}) — promo codes cannot be used after ticket sales close.` }); return false
      }
    }
    return true
  }

  function validateAgenda() {
    if (tracks.length === 0) {
      setFlash({ type: 'error', message: 'At least one agenda track is required.' }); return false
    }
    const eventStart = form.date && form.start_time ? `${form.date}T${form.start_time}` : null
    const eventEnd   = form.end_date && form.end_time ? `${form.end_date}T${form.end_time}` : null
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      const tn = i + 1
      if (!track.name.trim()) {
        setFlash({ type: 'error', message: `Track ${tn}: track name is required.` }); return false
      }
      if (track.sessions.length === 0) {
        setFlash({ type: 'error', message: `Track "${track.name || tn}": at least one session is required.` }); return false
      }
      for (let j = 0; j < track.sessions.length; j++) {
        const sess = track.sessions[j]
        const sn = j + 1
        if (!sess.title.trim()) {
          setFlash({ type: 'error', message: `Track ${tn}, Session ${sn}: session title is required.` }); return false
        }
        if (!sess.start_datetime) {
          setFlash({ type: 'error', message: `Track ${tn}, Session ${sn}: start time is required.` }); return false
        }
        if (!sess.end_datetime) {
          setFlash({ type: 'error', message: `Track ${tn}, Session ${sn}: end time is required.` }); return false
        }
        if (sess.end_datetime <= sess.start_datetime) {
          setFlash({ type: 'error', message: `Track ${tn}, Session ${sn}: end time must be after start time.` }); return false
        }
        if (eventStart && sess.start_datetime < eventStart) {
          setFlash({ type: 'error', message: `Track ${tn}, Session ${sn}: session starts before the event (${form.date} ${form.start_time}).` }); return false
        }
        if (eventEnd && sess.end_datetime > eventEnd) {
          setFlash({ type: 'error', message: `Track ${tn}, Session ${sn}: session ends after the event finishes (${form.end_date} ${form.end_time}).` }); return false
        }
      }
    }
    return true
  }

  function validateStep() {
    if (step === 1) return validateStep1()
    if (step === 3) return validateTiers()
    if (step === 4) return validateCodes()
    if (step === 5) return validateAgenda()
    return true
  }

  function next() {
    if (!validateStep()) return
    setStep(s => Math.min(s + 1, 5))
  }

  async function submitEvent(publish) {
    if (!validateStep1()) { setStep(1); return }
    if (!validateTiers())  { setStep(3); return }
    if (!validateCodes())  { setStep(4); return }
    if (!validateAgenda()) { setStep(5); return }

    setSubmitting(true)
    setCriticalOp(true)
    try {
      const { data: event } = await api.post('/api/events', buildPayload())
      const eventId = event.id

      for (const tier of tiers) {
        await api.post(`/api/events/${eventId}/ticket-tiers`, {
          name: tier.name.trim(),
          description: tier.description.trim() || null,
          price: parseFloat(tier.price) || 0,
          quantity: parseInt(tier.quantity, 10),
          sale_start: `${tier.sale_start}:00`,
          sale_end: `${tier.sale_end}:00`,
        })
      }

      for (const code of codes) {
        await api.post(`/api/events/${eventId}/promo-codes`, {
          code: code.code.trim(),
          discount_type: code.discount_type,
          discount_value: parseFloat(code.discount_value),
          max_uses: parseInt(code.max_uses, 10),
          valid_from: `${code.valid_from}:00`,
          valid_until: `${code.valid_until}:00`,
        })
      }

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i]
        const { data: createdTrack } = await api.post(`/api/events/${eventId}/tracks`, {
          name: track.name.trim(),
          color: track.color || null,
          order_index: i,
        })
        for (let j = 0; j < track.sessions.length; j++) {
          const sess = track.sessions[j]
          await api.post(`/api/tracks/${createdTrack.id}/sessions`, {
            title: sess.title.trim(),
            speaker_name: sess.speaker_name.trim() || null,
            location: sess.location.trim() || null,
            start_datetime: `${sess.start_datetime}:00`,
            end_datetime: `${sess.end_datetime}:00`,
            order_index: j,
          })
        }
      }

      if (publish) {
        await api.patch(`/api/events/${eventId}/publish`)
        navigate('/organizer/manage-event')
      } else {
        setFlash({ type: 'success', message: 'Draft saved successfully.' })
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setFlash({ type: 'error', message: 'Your session expired during submission. Log in again in another tab, then click Publish again — your form data is still here.' })
      } else {
        const detail = err.response?.data?.detail
        let msg
        if (typeof detail === 'string') {
          msg = detail
        } else if (Array.isArray(detail)) {
          msg = detail.map(d => d.msg || d.message || JSON.stringify(d)).join('; ')
        } else if (!err.response) {
          msg = 'Network error — check your connection and try again.'
        } else {
          msg = err.message || 'Something went wrong. Please try again.'
        }
        console.error('[CreateEvent] submit error', err.response?.status, err.response?.data)
        setFlash({ type: 'error', message: msg })
      }
    } finally {
      setCriticalOp(false)
      setSubmitting(false)
    }
  }

  return (
    <div className="ce-wizard">

      <div className="ce-wizard-header">
        <button className="ce-back-link" onClick={() => navigate('/organizer/dashboard')}>
          ← Back
        </button>
        <div className="ce-wizard-actions">
          <button className="btn-outline-sm" onClick={() => submitEvent(false)} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save draft'}
          </button>
          {step < 5
            ? <button className="btn-primary-sm" onClick={next}>Next →</button>
            : <button className="btn-primary-sm" onClick={() => submitEvent(true)} disabled={submitting}>
                {submitting ? 'Publishing…' : 'Publish event'}
              </button>
          }
        </div>
      </div>

      <div>
        <h1 className="page-header" style={{ marginBottom: 4 }}>Create a new event</h1>
        <p className="ce-subtitle">Step {step} of 5 · Draft autosaves as you go.</p>
      </div>

      <div className="ce-stepper">
        {STEPS.map(s => (
          <div
            key={s.n}
            className={`ce-step${step === s.n ? ' active' : step > s.n ? ' done' : ''}`}
          >
            <div className="ce-step-num">{s.n}</div>
            <div className="ce-step-info">
              <span className="ce-step-meta">Step {s.n}</span>
              <span className="ce-step-name">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {flash && (
        <div className={`ce-flash ce-flash--${flash.type}`}>{flash.message}</div>
      )}

      <div className="ce-form-card">
        {step === 1 && <Step1 form={form} set={set} categories={categories} />}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && <Step3 form={form} tiers={tiers} setTiers={setTiers} />}
        {step === 4 && <Step4 codes={codes} setCodes={setCodes} form={form} />}
        {step === 5 && <Step5 tracks={tracks} setTracks={setTracks} form={form} />}
      </div>

      <div className="ce-footer-nav">
        <button
          className="btn-outline-sm"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          ← Back
        </button>
        {step < 5
          ? <button className="btn-primary-sm" onClick={next}>Continue →</button>
          : <button className="btn-primary-sm" onClick={() => submitEvent(true)} disabled={submitting}>
              {submitting ? 'Publishing…' : 'Publish event'}
            </button>
        }
      </div>

    </div>
  )
}

/* ── Step 1 — Basic info ─────────────────────────────────────────────── */
function Step1({ form, set, categories }) {
  return (
    <div className="ce-fields">
      <div className="form-group">
        <label className="field-label">Event title</label>
        <input
          className="form-input"
          placeholder="e.g. Vector Summit 2026"
          value={form.title}
          onChange={e => set('title', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="field-label">Description</label>
        <textarea
          className="form-textarea"
          rows={4}
          placeholder="Short overview attendees will see on the event page"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="field-label">Category</label>
          <select
            className="form-input"
            value={form.category_id}
            onChange={e => set('category_id', e.target.value)}
          >
            <option value="">Select category…</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="field-label">Location type</label>
          <select
            className="form-input"
            value={form.location_type}
            onChange={e => set('location_type', e.target.value)}
          >
            <option value="physical">Physical</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>
      </div>

      {(form.location_type === 'physical' || form.location_type === 'hybrid') && (
        <div className="form-group">
          <label className="field-label">Physical address</label>
          <input
            className="form-input"
            placeholder="e.g. 123 Market St, San Francisco, CA"
            value={form.physical_address}
            onChange={e => set('physical_address', e.target.value)}
          />
        </div>
      )}

      {(form.location_type === 'online' || form.location_type === 'hybrid') && (
        <div className="form-group">
          <label className="field-label">Online link</label>
          <input
            className="form-input"
            placeholder="e.g. https://meet.example.com/event"
            value={form.online_link}
            onChange={e => set('online_link', e.target.value)}
          />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="field-label">Date</label>
          <input
            className="form-input"
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="field-label">Start time</label>
          <input
            className="form-input"
            type="time"
            value={form.start_time}
            onChange={e => set('start_time', e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="field-label">End date</label>
          <input
            className="form-input"
            type="date"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="field-label">End time</label>
          <input
            className="form-input"
            type="time"
            value={form.end_time}
            onChange={e => set('end_time', e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="field-label">Capacity</label>
        <input
          className="form-input"
          type="number"
          min="1"
          placeholder="e.g. 500 — leave blank for unlimited"
          value={form.capacity}
          onChange={e => set('capacity', e.target.value)}
        />
      </div>
    </div>
  )
}

/* ── Step 2 — Registration ───────────────────────────────────────────── */
function Step2({ form, set }) {
  return (
    <div className="ce-fields">
      <div className="form-group">
        <label className="field-label">Registration type</label>
        <div className="type-toggle">
          {[
            { value: 'automatic', label: 'Automatic' },
            { value: 'manual', label: 'Manual approval' },
            { value: 'invite_only', label: 'Invite only' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`type-toggle-btn${form.registration_type === opt.value ? ' active' : ''}`}
              onClick={() => set('registration_type', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="field-hint">
          {form.registration_type === 'automatic' && 'Attendees are confirmed immediately upon registration.'}
          {form.registration_type === 'manual' && 'You approve or reject each registration request manually.'}
          {form.registration_type === 'invite_only' && 'Only users with an invite link can register.'}
        </span>
      </div>

      <div className="toggle-row">
        <div>
          <div className="toggle-label">Requires registration</div>
          <div className="field-hint" style={{ marginTop: 2 }}>Attendees must register to attend</div>
        </div>
        <button
          className={`toggle-switch${form.requires_registration ? ' on' : ''}`}
          onClick={() => set('requires_registration', !form.requires_registration)}
        />
      </div>

      <div className="form-group">
        <label className="field-label">Feedback visibility</label>
        <div className="type-toggle">
          {[
            { value: 'public', label: 'Public' },
            { value: 'organizer_only', label: 'Organizer only' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`type-toggle-btn${form.feedback_visibility === opt.value ? ' active' : ''}`}
              onClick={() => set('feedback_visibility', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Step 3 — Ticket tiers ───────────────────────────────────────────── */
function Step3({ form, tiers, setTiers }) {
  const eventStart = form.date && form.start_time ? `${form.date}T${form.start_time}` : null
  const totalQty = tiers.reduce((s, t) => s + parseInt(t.quantity || 0, 10), 0)
  const capacityNum = form.capacity ? parseInt(form.capacity, 10) : null

  function updateTier(id, field, value) {
    setTiers(t => t.map(x => x._id === id ? { ...x, [field]: value } : x))
  }

  return (
    <div className="ce-fields">
      <div className="ce-step-intro">
        <p className="field-hint">
          Create ticket tiers with pricing and sale windows. Set price to $0 for a free tier. At least one tier is required.
        </p>
      </div>

      <div className="tier-list">
        {capacityNum && totalQty > capacityNum && (
          <div className="ce-warn-banner">
            Total ticket quantity ({totalQty}) exceeds event capacity ({capacityNum}). Reduce tier quantities or increase capacity in Step 1.
          </div>
        )}

        {tiers.map((tier, i) => {
          const priceNum = parseFloat(tier.price || 0)
          const qtyNum = parseInt(tier.quantity || 0, 10)
          const saleEndAfterEvent = eventStart && tier.sale_end && tier.sale_end > eventStart

          return (
            <div className="tier-card" key={tier._id}>
              <div className="tier-card-header">
                <span className="tier-card-title">Tier {i + 1}</span>
                {tiers.length > 1 && (
                  <button className="tier-remove" onClick={() => setTiers(t => t.filter(x => x._id !== tier._id))}>
                    Remove
                  </button>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="field-label">Name</label>
                  <input className="form-input" placeholder="e.g. General Admission"
                    value={tier.name}
                    onChange={e => updateTier(tier._id, 'name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="field-label">Price ($) <span className="field-optional">(0 for free)</span></label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tier.price}
                    onChange={e => updateTier(tier._id, 'price', e.target.value)}
                  />
                  {priceNum < 0 && (
                    <span className="field-warn">Price cannot be negative.</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="field-label">Quantity</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 100"
                    value={tier.quantity}
                    onChange={e => updateTier(tier._id, 'quantity', e.target.value)} />
                  {capacityNum && qtyNum > capacityNum && (
                    <span className="field-warn">Quantity exceeds total event capacity ({capacityNum}).</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="field-label">Description <span className="field-optional">(optional)</span></label>
                <input className="form-input" placeholder="e.g. Includes lunch and workshop access"
                  value={tier.description}
                  onChange={e => updateTier(tier._id, 'description', e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="field-label">Sale starts</label>
                  <input className="form-input" type="datetime-local"
                    value={tier.sale_start}
                    onChange={e => updateTier(tier._id, 'sale_start', e.target.value)} />
                  {tier.sale_start && tier.sale_end && tier.sale_end <= tier.sale_start && (
                    <span className="field-warn">Sale end must be after sale start.</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="field-label">Sale ends</label>
                  <input className="form-input" type="datetime-local"
                    value={tier.sale_end}
                    onChange={e => updateTier(tier._id, 'sale_end', e.target.value)} />
                  {saleEndAfterEvent && (
                    <span className="field-warn">Ticket sales should close before the event starts ({form.date}).</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <button className="add-tier-btn" onClick={() => setTiers(t => [...t, newTier()])}>
          + Add ticket tier
        </button>
      </div>
    </div>
  )
}

/* ── Step 4 — Promo codes ────────────────────────────────────────────── */
function Step4({ codes, setCodes, form }) {
  const eventStart = form.date && form.start_time ? `${form.date}T${form.start_time}` : null

  function updateCode(id, field, value) {
    setCodes(c => c.map(x => x._id === id ? { ...x, [field]: value } : x))
  }

  return (
    <div className="ce-fields">
      <div className="ce-step-intro">
        <p className="field-hint">
          Promo codes let attendees apply discounts at registration. This step is optional — skip it if you don't need promo codes.
        </p>
      </div>

      <div className="tier-list">
        {codes.map((code, i) => {
          const discountNum = parseFloat(code.discount_value || 0)
          const validUntilBeforeFrom = code.valid_until && code.valid_from && code.valid_until <= code.valid_from
          const validUntilAfterEvent = eventStart && code.valid_until && code.valid_until > eventStart

          return (
            <div className="tier-card" key={code._id}>
              <div className="tier-card-header">
                <span className="tier-card-title">Promo code {i + 1}</span>
                <button className="tier-remove" onClick={() => setCodes(c => c.filter(x => x._id !== code._id))}>
                  Remove
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="field-label">Code</label>
                  <input className="form-input" placeholder="e.g. EARLY25"
                    value={code.code}
                    style={{ textTransform: 'uppercase' }}
                    onChange={e => updateCode(code._id, 'code', e.target.value.toUpperCase())} />
                </div>
                <div className="form-group">
                  <label className="field-label">Discount type</label>
                  <select className="form-input"
                    value={code.discount_type}
                    onChange={e => updateCode(code._id, 'discount_type', e.target.value)}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed amount ($)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="field-label">
                    {code.discount_type === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
                  </label>
                  <input className="form-input" type="number" min="0.01"
                    max={code.discount_type === 'percentage' ? '100' : undefined}
                    step="0.01" placeholder={code.discount_type === 'percentage' ? '10' : '20.00'}
                    value={code.discount_value}
                    onChange={e => updateCode(code._id, 'discount_value', e.target.value)} />
                  {discountNum <= 0 && (
                    <span className="field-warn">Discount value must be greater than 0.</span>
                  )}
                  {code.discount_type === 'percentage' && discountNum > 100 && (
                    <span className="field-warn">Percentage discount cannot exceed 100%.</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="field-label">Max uses</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 100"
                    value={code.max_uses}
                    onChange={e => updateCode(code._id, 'max_uses', e.target.value)} />
                  {code.max_uses && parseInt(code.max_uses, 10) < 1 && (
                    <span className="field-warn">Max uses must be at least 1.</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="field-label">Valid from</label>
                  <input className="form-input" type="datetime-local"
                    max={eventStart || undefined}
                    value={code.valid_from}
                    onChange={e => updateCode(code._id, 'valid_from', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="field-label">Valid until</label>
                  <input className="form-input" type="datetime-local"
                    max={eventStart || undefined}
                    value={code.valid_until}
                    onChange={e => updateCode(code._id, 'valid_until', e.target.value)} />
                  {validUntilBeforeFrom && (
                    <span className="field-warn">Valid until must be after valid from.</span>
                  )}
                  {!validUntilBeforeFrom && validUntilAfterEvent && (
                    <span className="field-warn">Promo codes must expire before the event starts ({form.date} {form.start_time}) — codes can't be used once ticket sales close.</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <button className="add-tier-btn" onClick={() => setCodes(c => [...c, newCode()])}>
          + Add promo code
        </button>
      </div>
    </div>
  )
}

/* ── Step 5 — Agenda builder ─────────────────────────────────────────── */
const TRACK_COLORS = ['#4A9EFF', '#51CF66', '#FF6B6B', '#FFB300', '#CC5DE8', '#74C0FC']

function Step5({ tracks, setTracks, form }) {
  const eventStart = form.date && form.start_time ? `${form.date}T${form.start_time}` : null
  const eventEnd   = form.end_date && form.end_time ? `${form.end_date}T${form.end_time}` : null

  function updateTrack(trid, field, value) {
    setTracks(ts => ts.map(t => t._id === trid ? { ...t, [field]: value } : t))
  }

  function addSession(trid) {
    setTracks(ts => ts.map(t => t._id === trid
      ? { ...t, sessions: [...t.sessions, newSession()] }
      : t
    ))
  }

  function removeSession(trid, sid) {
    setTracks(ts => ts.map(t => t._id === trid
      ? { ...t, sessions: t.sessions.filter(s => s._id !== sid) }
      : t
    ))
  }

  function updateSession(trid, sid, field, value) {
    setTracks(ts => ts.map(t => t._id === trid
      ? { ...t, sessions: t.sessions.map(s => s._id === sid ? { ...s, [field]: value } : s) }
      : t
    ))
  }

  return (
    <div className="ce-fields">
      <div className="ce-step-intro">
        <p className="field-hint">
          Build the agenda for your event. Add tracks (e.g. "Main Stage", "Workshop Room") and sessions within each track. At least one track with one session is required.
        </p>
        {eventStart && eventEnd && (
          <p className="field-hint" style={{ marginTop: 6 }}>
            Sessions must fall within the event window: <strong>{form.date} {form.start_time}</strong> → <strong>{form.end_date} {form.end_time}</strong>.
          </p>
        )}
      </div>

      <div className="tier-list">
        {tracks.map((track, ti) => (
          <div className="tier-card agenda-track-card" key={track._id}>
            <div className="tier-card-header">
              <span className="tier-card-title">Track {ti + 1}</span>
              {tracks.length > 1 && (
                <button className="tier-remove"
                  onClick={() => setTracks(ts => ts.filter(t => t._id !== track._id))}>
                  Remove track
                </button>
              )}
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="field-label">Track name</label>
                <input className="form-input" placeholder="e.g. Main Stage"
                  value={track.name}
                  onChange={e => updateTrack(track._id, 'name', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="field-label">Color <span className="field-optional">(optional)</span></label>
                <div className="color-picker">
                  {TRACK_COLORS.map(c => (
                    <button
                      key={c}
                      className={`color-swatch${track.color === c ? ' selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateTrack(track._id, 'color', track.color === c ? '' : c)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="agenda-sessions">
              {track.sessions.map((sess, si) => {
                const endBeforeStart = sess.end_datetime && sess.start_datetime && sess.end_datetime <= sess.start_datetime
                const startBeforeEvent = eventStart && sess.start_datetime && sess.start_datetime < eventStart
                const endAfterEvent = eventEnd && sess.end_datetime && sess.end_datetime > eventEnd

                return (
                  <div className="agenda-session" key={sess._id}>
                    <div className="agenda-session-header">
                      <span className="agenda-session-label">Session {si + 1}</span>
                      {track.sessions.length > 1 && (
                        <button className="tier-remove"
                          onClick={() => removeSession(track._id, sess._id)}>
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="form-row">
                      <div className="form-group" style={{ flex: 2 }}>
                        <label className="field-label">Session title</label>
                        <input className="form-input" placeholder="e.g. Keynote: Future of AI"
                          value={sess.title}
                          onChange={e => updateSession(track._id, sess._id, 'title', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="field-label">Speaker <span className="field-optional">(optional)</span></label>
                        <input className="form-input" placeholder="e.g. Jane Smith"
                          value={sess.speaker_name}
                          onChange={e => updateSession(track._id, sess._id, 'speaker_name', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="field-label">Start time</label>
                        <input className="form-input" type="datetime-local"
                          min={eventStart || undefined}
                          max={eventEnd || undefined}
                          value={sess.start_datetime}
                          onChange={e => updateSession(track._id, sess._id, 'start_datetime', e.target.value)} />
                        {startBeforeEvent && (
                          <span className="field-warn">Must be on or after the event start ({form.date} {form.start_time}).</span>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="field-label">End time</label>
                        <input className="form-input" type="datetime-local"
                          min={sess.start_datetime || eventStart || undefined}
                          max={eventEnd || undefined}
                          value={sess.end_datetime}
                          onChange={e => updateSession(track._id, sess._id, 'end_datetime', e.target.value)} />
                        {endBeforeStart && (
                          <span className="field-warn">End time must be after start time.</span>
                        )}
                        {!endBeforeStart && endAfterEvent && (
                          <span className="field-warn">Must be on or before the event end ({form.end_date} {form.end_time}).</span>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="field-label">Room / location <span className="field-optional">(optional)</span></label>
                        <input className="form-input" placeholder="e.g. Hall A"
                          value={sess.location}
                          onChange={e => updateSession(track._id, sess._id, 'location', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )
              })}

              <button className="add-session-btn" onClick={() => addSession(track._id)}>
                + Add session to this track
              </button>
            </div>
          </div>
        ))}

        <button className="add-tier-btn" onClick={() => setTracks(ts => [...ts, newTrack()])}>
          + Add track
        </button>
      </div>
    </div>
  )
}
