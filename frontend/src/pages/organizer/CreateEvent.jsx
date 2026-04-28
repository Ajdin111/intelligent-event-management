import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { categoriesApi } from '../../services/api'

const STEPS = [
  { n: 1, label: 'Basic info' },
  { n: 2, label: 'Registration' },
  { n: 3, label: 'Ticket tiers' },
  { n: 4, label: 'Agenda builder' },
]

let _tid = 0
const newTier = () => ({
  _id: ++_tid,
  name: '',
  description: '',
  price: '0.00',
  quantity: '',
  sale_start: '',
  sale_end: '',
})

function toNaiveDatetime(date, time) {
  if (!date || !time) return null
  return `${date}T${time}:00`
}

export default function CreateEvent() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [flash, setFlash] = useState(null)
  const [tiers, setTiers] = useState([])
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
    is_free: true,
    has_ticketing: false,
    feedback_visibility: 'public',
  })

  useEffect(() => {
    categoriesApi.list()
      .then(res => setCategories(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 4000)
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
      has_ticketing: form.has_ticketing,
      is_free: form.is_free,
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
    if (!form.has_ticketing || form.is_free) return true
    if (tiers.length === 0) {
      setFlash({ type: 'error', message: 'Add at least one ticket tier.' }); return false
    }
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i]
      if (!t.name.trim()) {
        setFlash({ type: 'error', message: `Tier ${i + 1}: name is required.` }); return false
      }
      if (!t.quantity || parseInt(t.quantity, 10) < 1) {
        setFlash({ type: 'error', message: `Tier ${i + 1}: quantity must be at least 1.` }); return false
      }
      if (!t.sale_start) {
        setFlash({ type: 'error', message: `Tier ${i + 1}: sale start is required.` }); return false
      }
      if (!t.sale_end) {
        setFlash({ type: 'error', message: `Tier ${i + 1}: sale end is required.` }); return false
      }
      if (t.sale_end <= t.sale_start) {
        setFlash({ type: 'error', message: `Tier ${i + 1}: sale end must be after sale start.` }); return false
      }
    }
    return true
  }

  function validateStep() {
    if (step === 1) return validateStep1()
    if (step === 3) return validateTiers()
    return true
  }

  function next() {
    if (!validateStep()) return
    setStep(s => s + 1)
  }

  async function submitEvent(publish) {
    if (!validateStep1()) { setStep(1); return }
    if (!validateTiers()) { setStep(3); return }

    setSubmitting(true)
    try {
      const { data: event } = await api.post('/api/events', buildPayload())

      if (form.has_ticketing && !form.is_free && tiers.length > 0) {
        for (const tier of tiers) {
          await api.post(`/api/events/${event.id}/ticket-tiers`, {
            name: tier.name.trim(),
            description: tier.description.trim() || null,
            price: parseFloat(tier.price) || 0,
            quantity: parseInt(tier.quantity, 10),
            sale_start: `${tier.sale_start}:00`,
            sale_end: `${tier.sale_end}:00`,
          })
        }
      }

      if (publish) {
        await api.patch(`/api/events/${event.id}/publish`)
        navigate('/organizer/manage-event')
      } else {
        setFlash({ type: 'success', message: 'Draft saved successfully.' })
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map(d => d.msg).join(', ')
          : 'Something went wrong. Please try again.'
      setFlash({ type: 'error', message: msg })
    } finally {
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
          {step < 4
            ? <button className="btn-primary-sm" onClick={next}>Next →</button>
            : <button className="btn-primary-sm" onClick={() => submitEvent(true)} disabled={submitting}>
                {submitting ? 'Publishing…' : 'Publish event'}
              </button>
          }
        </div>
      </div>

      <div>
        <h1 className="page-header" style={{ marginBottom: 4 }}>Create a new event</h1>
        <p className="ce-subtitle">Step {step} of 4 · Draft autosaves as you go.</p>
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
        {step === 3 && <Step3 form={form} set={set} tiers={tiers} setTiers={setTiers} />}
        {step === 4 && <Step4 />}
      </div>

      <div className="ce-footer-nav">
        <button
          className="btn-outline-sm"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
        >
          ← Back
        </button>
        {step < 4
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
          placeholder="e.g. 500"
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

      <div className="toggle-row">
        <div>
          <div className="toggle-label">Free event</div>
          <div className="field-hint" style={{ marginTop: 2 }}>No tickets or payment required</div>
        </div>
        <button
          className={`toggle-switch${form.is_free ? ' on' : ''}`}
          onClick={() => {
            const next = !form.is_free
            set('is_free', next)
            if (next) set('has_ticketing', false)
          }}
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
function Step3({ form, set, tiers, setTiers }) {
  if (form.is_free) {
    return (
      <div className="ce-fields">
        <div className="ce-empty-notice">
          This is a free event — no ticket tiers needed. Go back to Step 2 to enable paid ticketing.
        </div>
      </div>
    )
  }

  return (
    <div className="ce-fields">
      <div className="toggle-row" style={{ borderTop: 'none', paddingTop: 0 }}>
        <div>
          <div className="toggle-label">Enable ticketing</div>
          <div className="field-hint" style={{ marginTop: 2 }}>Create ticket tiers with pricing</div>
        </div>
        <button
          className={`toggle-switch${form.has_ticketing ? ' on' : ''}`}
          onClick={() => set('has_ticketing', !form.has_ticketing)}
        />
      </div>

      {form.has_ticketing && (
        <div className="tier-list">
          {tiers.map((tier, i) => (
            <div className="tier-card" key={tier._id}>
              <div className="tier-card-header">
                <span className="tier-card-title">Tier {i + 1}</span>
                <button className="tier-remove" onClick={() => setTiers(t => t.filter(x => x._id !== tier._id))}>
                  Remove
                </button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="field-label">Name</label>
                  <input className="form-input" placeholder="e.g. General Admission" value={tier.name}
                    onChange={e => setTiers(t => t.map(x => x._id === tier._id ? { ...x, name: e.target.value } : x))} />
                </div>
                <div className="form-group">
                  <label className="field-label">Price ($)</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={tier.price}
                    onChange={e => setTiers(t => t.map(x => x._id === tier._id ? { ...x, price: e.target.value } : x))} />
                </div>
                <div className="form-group">
                  <label className="field-label">Quantity</label>
                  <input className="form-input" type="number" min="1" placeholder="e.g. 100" value={tier.quantity}
                    onChange={e => setTiers(t => t.map(x => x._id === tier._id ? { ...x, quantity: e.target.value } : x))} />
                </div>
              </div>
              <div className="form-group">
                <label className="field-label">Description</label>
                <input className="form-input" placeholder="Optional tier description" value={tier.description}
                  onChange={e => setTiers(t => t.map(x => x._id === tier._id ? { ...x, description: e.target.value } : x))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="field-label">Sale starts</label>
                  <input className="form-input" type="datetime-local" value={tier.sale_start}
                    onChange={e => setTiers(t => t.map(x => x._id === tier._id ? { ...x, sale_start: e.target.value } : x))} />
                </div>
                <div className="form-group">
                  <label className="field-label">Sale ends</label>
                  <input className="form-input" type="datetime-local" value={tier.sale_end}
                    onChange={e => setTiers(t => t.map(x => x._id === tier._id ? { ...x, sale_end: e.target.value } : x))} />
                </div>
              </div>
            </div>
          ))}
          <button className="add-tier-btn" onClick={() => setTiers(t => [...t, newTier()])}>
            + Add ticket tier
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Step 4 — Agenda builder ─────────────────────────────────────────── */
function Step4() {
  return (
    <div className="ce-fields">
      <div className="ce-empty-notice">
        Agenda builder is available after publishing. Add tracks, sessions, and speakers from the Agenda page once your event is live.
      </div>
    </div>
  )
}
