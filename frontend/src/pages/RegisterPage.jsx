import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await register(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>TeqEvent</div>
        <h1 className={styles.heading}>Create account</h1>
        {error && <p className={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <input className="input" placeholder="First name" value={form.first_name} onChange={set('first_name')} required />
          <input className="input" placeholder="Last name"  value={form.last_name}  onChange={set('last_name')}  required />
          <input className="input" type="email"    placeholder="Email"    value={form.email}    onChange={set('email')}    required />
          <input className="input" type="password" placeholder="Password" value={form.password} onChange={set('password')} required />
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '9px' }}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p className={styles.switch}>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  )
}
