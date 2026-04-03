import { useState } from 'react'
import Topbar from '../components/layout/Topbar'
import styles from './PreferencesPage.module.css'

// TODO: load real preferences via api.get('/notifications/preferences')
// and save via api.patch('/notifications/preferences') when Member 4 merges

const DEFAULT_PREFS = {
  registration_confirmation: true,
  event_reminders:           true,
  approval_updates:          true,
  feedback_requests:         true,
  waitlist_updates:          true,
  invite_notifications:      true,
  email_enabled:             true,
  in_app_enabled:            true,
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={checked ? styles.toggleOn : styles.toggleOff}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}

function PrefRow({ label, description, checked, onChange }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <p className={styles.rowLabel}>{label}</p>
        <p className={styles.rowDesc}>{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [saved, setSaved] = useState(false)

  function set(key) {
    return (val) => {
      setPrefs((prev) => ({ ...prev, [key]: val }))
      setSaved(false)
    }
  }

  function handleSave() {
    // TODO: api.patch('/notifications/preferences', prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className={styles.page}>
      <Topbar title="Preferences" />
      <div className={styles.content}>

        <h1 className={styles.heading}>Preferences</h1>
        <p className={styles.subheading}>Manage how and when TeqEvent notifies you.</p>

        {/* Notification types */}
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Notification Types</p>
          <div className={styles.card}>
            <PrefRow
              label="Registration confirmation"
              description="Get notified when your registration is confirmed."
              checked={prefs.registration_confirmation}
              onChange={set('registration_confirmation')}
            />
            <div className={styles.divider} />
            <PrefRow
              label="Event reminders"
              description="Receive reminders 24h and 1h before an event starts."
              checked={prefs.event_reminders}
              onChange={set('event_reminders')}
            />
            <div className={styles.divider} />
            <PrefRow
              label="Approval updates"
              description="Get notified when your registration is approved or rejected."
              checked={prefs.approval_updates}
              onChange={set('approval_updates')}
            />
            <div className={styles.divider} />
            <PrefRow
              label="Feedback requests"
              description="Receive a prompt to leave feedback after an event ends."
              checked={prefs.feedback_requests}
              onChange={set('feedback_requests')}
            />
            <div className={styles.divider} />
            <PrefRow
              label="Waitlist updates"
              description="Get notified when a spot opens up for an event you are waiting for."
              checked={prefs.waitlist_updates}
              onChange={set('waitlist_updates')}
            />
            <div className={styles.divider} />
            <PrefRow
              label="Invite notifications"
              description="Get notified when an organizer sends you a direct invite."
              checked={prefs.invite_notifications}
              onChange={set('invite_notifications')}
            />
          </div>
        </section>

        {/* Channels */}
        <section className={styles.section}>
          <p className={styles.sectionTitle}>Channels</p>
          <div className={styles.card}>
            <PrefRow
              label="Email notifications"
              description="Send notifications to your registered email address."
              checked={prefs.email_enabled}
              onChange={set('email_enabled')}
            />
            <div className={styles.divider} />
            <PrefRow
              label="In-app notifications"
              description="Show notifications inside the TeqEvent platform."
              checked={prefs.in_app_enabled}
              onChange={set('in_app_enabled')}
            />
          </div>
        </section>

        {/* Save */}
        <div className={styles.saveRow}>
          <button className={styles.saveBtn} onClick={handleSave}>
            {saved ? 'Saved' : 'Save preferences'}
          </button>
          {saved && <p className={styles.savedMsg}>Your preferences have been saved.</p>}
        </div>

      </div>
    </div>
  )
}