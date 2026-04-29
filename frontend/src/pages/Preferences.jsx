import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getDeliveryLabel(prefs) {
  if (!prefs) return '—'
  if (prefs.email_enabled && prefs.in_app_enabled) return 'Email + In-app'
  if (prefs.email_enabled) return 'Email'
  if (prefs.in_app_enabled) return 'In-app'
  return 'Disabled'
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
  const [history, setHistory] = useState([])
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
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

    notificationsApi.list()
      .then((res) => setHistory(res.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false))
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

  const organizerCards = prefs ? [
    {
      title: 'Reminder delivery',
      description: 'Control attendee reminders and feedback follow-ups from one place.',
      fields: [['event_reminders', 'Event reminders'], ['feedback_requests', 'Feedback requests']],
    },
    {
      title: 'Approval workflow',
      description: 'Manage registration, approval, and waitlist-related updates.',
      fields: [['registration_confirmation', 'Registration confirmations'], ['approval_updates', 'Approval updates'], ['waitlist_updates', 'Waitlist updates']],
    },
    {
      title: 'Channel routing',
      description: 'Choose where organizer notifications should be delivered.',
      fields: [['email_enabled', 'Email delivery'], ['in_app_enabled', 'In-app delivery'], ['invite_notifications', 'Invite notifications']],
    },
  ] : []

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
          {activeRole === 'organizer' ? (
            <>
              <div className="settings-panel-head">
                <div>
                  <h2 className="settings-panel-title">Notifications</h2>
                  <p className="settings-panel-subtitle">
                    Manage organizer reminders, approvals, and attendee updates.
                  </p>
                </div>
                <Link to="/organizer/notifications" className="settings-btn settings-btn--ghost">
                  Open hub
                </Link>
              </div>

              {loadingPrefs ? (
                <div className="page-placeholder settings-placeholder">Loading notification preferences…</div>
              ) : !prefs ? (
                <div className="page-placeholder settings-placeholder">Could not load notification preferences.</div>
              ) : (
                <>
                  <div className="org-settings-card-grid">
                    {organizerCards.map((card) => (
                      <div key={card.title} className="org-settings-card">
                        <div className="org-settings-card-head">
                          <h3 className="org-settings-card-title">{card.title}</h3>
                          <span className="org-settings-card-badge">{getDeliveryLabel(prefs)}</span>
                        </div>
                        <p className="org-settings-card-copy">{card.description}</p>
                        <div className="org-settings-mini-list">
                          {card.fields.map(([field, label]) => (
                            <div key={field} className="org-settings-mini-row">
                              <span className="org-settings-mini-label">{label}</span>
                              <button
                                type="button"
                                className={`toggle-switch${prefs[field] ? ' on' : ''}`}
                                onClick={() => handlePrefToggle(field)}
                                aria-pressed={prefs[field]}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="org-settings-history">
                    <div className="org-settings-history-head">
                      <h3 className="org-settings-history-title">Notification history</h3>
                    </div>

                    {loadingHistory ? (
                      <div className="page-placeholder settings-placeholder settings-placeholder--compact">Loading notification history…</div>
                    ) : history.length === 0 ? (
                      <div className="page-placeholder settings-placeholder settings-placeholder--compact">No notification history available yet.</div>
                    ) : (
                      <div className="org-settings-table-wrap">
                        <table className="org-settings-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Title</th>
                              <th>Channel</th>
                              <th>Status</th>
                              <th>Sent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.slice(0, 8).map((item) => (
                              <tr key={item.id}>
                                <td>{item.type.replaceAll('_', ' ')}</td>
                                <td>{item.title}</td>
                                <td>{getDeliveryLabel(prefs)}</td>
                                <td>{item.is_read ? 'Read' : 'Unread'}</td>
                                <td>{formatRelativeTime(item.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
            </>
          ) : (
            <>
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
            </>
          )}
        </section>
      </div>
    </div>
  )
}
