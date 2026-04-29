import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { notificationsApi } from '../services/api'

const notificationFields = [
  ['registration_confirmation', 'Registration confirmations'],
  ['event_reminders', 'Event reminders'],
  ['approval_updates', 'Approval updates'],
  ['feedback_requests', 'Feedback requests'],
  ['waitlist_updates', 'Waitlist updates'],
  ['invite_notifications', 'Invite notifications'],
  ['email_enabled', 'Email notifications'],
  ['in_app_enabled', 'In-app notifications'],
]

function getInitials(user) {
  if (!user) return 'U'
  return `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
}

export default function Preferences() {
  const { user, activeRole } = useAuth()
  const { hash } = useLocation()
  const [nameDraft, setNameDraft] = useState({ first_name: '', last_name: '' })
  const [passwordDraft, setPasswordDraft] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [prefs, setPrefs] = useState(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMessage, setPrefsMessage] = useState('')

  useEffect(() => {
    if (user) {
      setNameDraft({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
      })
    }
  }, [user])

  useEffect(() => {
    notificationsApi.getPreferences()
      .then((res) => setPrefs(res.data))
      .catch(() => setPrefs(null))
      .finally(() => setLoadingPrefs(false))
  }, [])

  useEffect(() => {
    if (hash === '#notifications') {
      document.getElementById('notification-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hash])

  const fullName = useMemo(() => {
    if (!user) return 'Your profile'
    return `${user.first_name} ${user.last_name}`
  }, [user])

  const handlePrefToggle = (field) => {
    setPrefs((current) => current ? { ...current, [field]: !current[field] } : current)
  }

  const handleSavePreferences = async () => {
    if (!prefs) return
    setSavingPrefs(true)
    setPrefsMessage('')
    try {
      const payload = notificationFields.reduce((acc, [field]) => {
        acc[field] = prefs[field]
        return acc
      }, {})
      const res = await notificationsApi.updatePreferences(payload)
      setPrefs(res.data)
      setPrefsMessage('Notification settings saved.')
    } catch {
      setPrefsMessage('Could not save notification settings right now.')
    } finally {
      setSavingPrefs(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="page-header">Profile Settings</h1>
          <p className="settings-subtitle">
            Manage your profile details and notification preferences from one place.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card settings-card--profile">
          <div className="settings-card-head">
            <h2 className="settings-card-title">Profile</h2>
          </div>

          <div className="settings-identity">
            <div className="settings-avatar">{getInitials(user)}</div>
            <div>
              <p className="settings-identity-name">{fullName}</p>
              <p className="settings-identity-role">{activeRole}</p>
              <p className="settings-identity-email">{user?.email}</p>
            </div>
          </div>

          <div className="form-row settings-form-block">
            <label className="field">
              <span className="field-label">First name</span>
              <input
                className="form-input"
                value={nameDraft.first_name}
                onChange={(e) => setNameDraft((current) => ({ ...current, first_name: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">Last name</span>
              <input
                className="form-input"
                value={nameDraft.last_name}
                onChange={(e) => setNameDraft((current) => ({ ...current, last_name: e.target.value }))}
              />
            </label>
          </div>

          <label className="field settings-form-block settings-form-block--spaced">
            <span className="field-label">Email</span>
            <input className="form-input" value={user?.email ?? ''} disabled />
          </label>

          <button className="settings-btn settings-btn--muted" disabled>
            Save profile changes
          </button>

          <div className="settings-divider" />

          <div className="settings-card-head settings-card-head--subsection">
            <h2 className="settings-card-title">Password</h2>
          </div>

          <div className="settings-form-stack">
            <label className="field">
              <span className="field-label">Current password</span>
              <input
                type="password"
                className="form-input"
                value={passwordDraft.current_password}
                onChange={(e) => setPasswordDraft((current) => ({ ...current, current_password: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">New password</span>
              <input
                type="password"
                className="form-input"
                value={passwordDraft.new_password}
                onChange={(e) => setPasswordDraft((current) => ({ ...current, new_password: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm new password</span>
              <input
                type="password"
                className="form-input"
                value={passwordDraft.confirm_password}
                onChange={(e) => setPasswordDraft((current) => ({ ...current, confirm_password: e.target.value }))}
              />
            </label>
          </div>

          <button className="settings-btn settings-btn--muted" disabled>
            Update password
          </button>
        </section>

        <section className="settings-card" id="notification-settings">
          <div className="settings-card-head">
            <h2 className="settings-card-title">Notification Settings</h2>
          </div>

          {loadingPrefs ? (
            <div className="page-placeholder settings-placeholder">Loading notification preferences…</div>
          ) : !prefs ? (
            <div className="page-placeholder settings-placeholder">Could not load notification preferences.</div>
          ) : (
            <>
              <div className="settings-toggle-list">
                {notificationFields.map(([field, label]) => (
                  <div key={field} className="toggle-row">
                    <div>
                      <div className="toggle-label">{label}</div>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch${prefs[field] ? ' on' : ''}`}
                      onClick={() => handlePrefToggle(field)}
                      aria-pressed={prefs[field]}
                    />
                  </div>
                ))}
              </div>

              <div className="settings-actions">
                <button
                  className="settings-btn"
                  onClick={handleSavePreferences}
                  disabled={savingPrefs}
                >
                  {savingPrefs ? 'Saving…' : 'Save notification settings'}
                </button>
                {prefsMessage && <span className="settings-feedback">{prefsMessage}</span>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
