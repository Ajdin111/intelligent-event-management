import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authApi, notificationsApi } from '../../services/api'

const DELIVERY_FIELDS = [
  ['email_enabled',  'Email delivery'],
  ['in_app_enabled', 'In-app delivery'],
]

function getInitials(user) {
  if (!user) return 'U'
  return `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
}


export default function AdminProfile() {
  const { user, setUser, loading } = useAuth()

  const [nameDraft, setNameDraft] = useState({ first_name: '', last_name: '' })
  const [savingProfile, setSavingProfile]   = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const [passwordDraft, setPasswordDraft] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [savingPassword, setSavingPassword]   = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')

  const [prefs, setPrefs]               = useState(null)
  const [loadingPrefs, setLoadingPrefs] = useState(true)
  const [savingPrefs, setSavingPrefs]   = useState(false)
  const [prefsMessage, setPrefsMessage] = useState('')


  useEffect(() => {
    if (user) {
      setNameDraft({ first_name: user.first_name ?? '', last_name: user.last_name ?? '' })
    }
  }, [user])

  useEffect(() => {
    notificationsApi.getPreferences()
      .then(res => setPrefs(res.data))
      .catch(() => setPrefs(null))
      .finally(() => setLoadingPrefs(false))
  }, [])

  const fullName = useMemo(() => {
    if (!user) return '—'
    return `${user.first_name} ${user.last_name}`
  }, [user])

  const handleSaveProfile = async () => {
    if (!nameDraft.first_name.trim() || !nameDraft.last_name.trim()) {
      setProfileMessage('First and last name are required.')
      return
    }
    setSavingProfile(true)
    setProfileMessage('')
    try {
      const res = await authApi.updateProfile(nameDraft)
      setUser(res.data)
      setProfileMessage('Profile updated.')
    } catch {
      setProfileMessage('Could not save profile changes.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordMessage('')
    if (!passwordDraft.current_password || !passwordDraft.new_password || !passwordDraft.confirm_password) {
      setPasswordMessage('Please fill in all password fields.')
      return
    }
    if (passwordDraft.new_password !== passwordDraft.confirm_password) {
      setPasswordMessage('New passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      await authApi.changePassword({
        current_password: passwordDraft.current_password,
        new_password: passwordDraft.new_password,
      })
      setPasswordDraft({ current_password: '', new_password: '', confirm_password: '' })
      setPasswordMessage('Password updated successfully.')
    } catch (err) {
      setPasswordMessage(err.response?.data?.detail ?? 'Could not update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handlePrefToggle = field => {
    setPrefs(cur => cur ? { ...cur, [field]: !cur[field] } : cur)
  }

  const handleSavePreferences = async () => {
    if (!prefs) return
    setSavingPrefs(true)
    setPrefsMessage('')
    try {
      const res = await notificationsApi.updatePreferences(prefs)
      setPrefs(res.data)
      setPrefsMessage('Notification settings saved.')
    } catch {
      setPrefsMessage('Could not save notification settings.')
    } finally {
      setSavingPrefs(false)
    }
  }

  if (loading) return null

  if (!user) {
    return (
      <div className="settings-page">
        <div className="page-placeholder">Could not load profile. Please refresh.</div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <div className="settings-grid">

        {/* ── Left column: Profile + Password ─────────────────────── */}
        <section className="settings-card settings-card--profile">
          <div className="settings-card-head">
            <h2 className="settings-card-title">Profile</h2>
          </div>

          <div className="settings-identity">
            <div className="settings-avatar">{getInitials(user)}</div>
            <div>
              <p className="settings-identity-name">{fullName}</p>
              <p className="settings-identity-role">System Admin</p>
              <p className="settings-identity-email">{user.email}</p>
            </div>
          </div>

          <div className="form-row settings-form-block">
            <label className="field">
              <span className="field-label">First name</span>
              <input
                className="form-input"
                value={nameDraft.first_name}
                onChange={e => setNameDraft(cur => ({ ...cur, first_name: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">Last name</span>
              <input
                className="form-input"
                value={nameDraft.last_name}
                onChange={e => setNameDraft(cur => ({ ...cur, last_name: e.target.value }))}
              />
            </label>
          </div>

          <label className="field settings-form-block settings-form-block--spaced">
            <span className="field-label">Email</span>
            <input className="form-input" value={user.email} disabled />
          </label>

          <div className="settings-actions">
            <button className="settings-btn" onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile changes'}
            </button>
            {profileMessage && <span className="settings-feedback">{profileMessage}</span>}
          </div>

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
                onChange={e => setPasswordDraft(cur => ({ ...cur, current_password: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">New password</span>
              <input
                type="password"
                className="form-input"
                value={passwordDraft.new_password}
                onChange={e => setPasswordDraft(cur => ({ ...cur, new_password: e.target.value }))}
              />
            </label>
            <label className="field">
              <span className="field-label">Confirm new password</span>
              <input
                type="password"
                className="form-input"
                value={passwordDraft.confirm_password}
                onChange={e => setPasswordDraft(cur => ({ ...cur, confirm_password: e.target.value }))}
              />
            </label>
          </div>

          <div className="settings-actions">
            <button className="settings-btn" onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
            {passwordMessage && <span className="settings-feedback">{passwordMessage}</span>}
          </div>
        </section>

        {/* ── Right column: Notification delivery ──────────────────── */}
        <section className="settings-card settings-card--profile" id="notification-settings">
          <div className="settings-card-head">
            <h2 className="settings-card-title">Notification Settings</h2>
          </div>

          {loadingPrefs ? (
            <div className="page-placeholder settings-placeholder">Loading notification preferences…</div>
          ) : !prefs ? (
            <div className="page-placeholder settings-placeholder">Could not load notification preferences.</div>
          ) : (
            <>
              <div className="settings-toggle-list" style={{ marginTop: 10 }}>
                {DELIVERY_FIELDS.map(([field, label]) => (
                  <div key={field} className="toggle-row">
                    <div className="toggle-label">{label}</div>
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
                <button className="settings-btn" onClick={handleSavePreferences} disabled={savingPrefs}>
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
