#!/bin/bash

# =============================================================
#  TeqEvent — Frontend Scaffold Script
#  Member 5 | React + Vite | IBM Plex Sans | Linear/Vercel style
#  Run from the ROOT of the repo: bash setup_frontend.sh
# =============================================================

set -e

FRONTEND="./frontend"

echo ""
echo "  TeqEvent Frontend Scaffold"
echo "  =========================="
echo ""

# ── 0. Check we're in the right place ─────────────────────────
if [ ! -d "$FRONTEND" ]; then
  echo "  ERROR: No 'frontend/' folder found."
  echo "  Make sure you run this from the root of intelligent-event-management/"
  exit 1
fi

cd "$FRONTEND"

# ── 1. Vite + React init (skip if already done) ───────────────
if [ ! -f "package.json" ]; then
  echo "  [1/6] Initialising Vite + React..."
  npm create vite@latest . -- --template react --yes
else
  echo "  [1/6] package.json found — skipping Vite init"
fi

# ── 2. Install dependencies ───────────────────────────────────
echo "  [2/6] Installing dependencies..."
npm install
npm install axios react-router-dom

# ── 3. Create folder structure ────────────────────────────────
echo "  [3/6] Creating folder structure..."
mkdir -p src/components/layout
mkdir -p src/components/ui
mkdir -p src/pages
mkdir -p src/contexts
mkdir -p src/lib
mkdir -p src/assets

# ── 4. Write all source files ─────────────────────────────────
echo "  [4/6] Writing source files..."

# ── vite.config.js ────────────────────────────────────────────
cat > vite.config.js << 'VITE'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
VITE

# ── index.html ────────────────────────────────────────────────
cat > index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TeqEvent</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
HTML

# ── src/index.css ─────────────────────────────────────────────
cat > src/index.css << 'CSS'
/* TeqEvent Design System — IBM Plex Sans + Linear/Vercel aesthetic */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  /* Colors */
  --bg-primary:    rgb(26, 31, 34);
  --bg-surface:    rgb(231, 233, 236);
  --bg-card:       #1e2428;
  --bg-card-hover: #242a2e;
  --bg-input:      #1e2428;
  --border:        #2e363b;
  --border-hover:  #3e474d;

  /* Text */
  --text-primary:   #ffffff;
  --text-secondary: #8a9399;
  --text-muted:     #5a6469;

  /* Accent */
  --accent:         #e7e9ec;

  /* Radius */
  --radius-card: 8px;
  --radius-btn:  6px;
  --radius-input: 6px;

  /* Font */
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* Primary button */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: #ffffff;
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-btn);
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.15s;
}
.btn-primary:hover { opacity: 0.88; }

/* Secondary button */
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  font-size: 13px;
  font-weight: 400;
  transition: border-color 0.15s, background 0.15s;
}
.btn-secondary:hover {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
}

/* Input */
.input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-input);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: var(--border-hover); }
.input::placeholder { color: var(--text-muted); }
CSS

# ── src/main.jsx ──────────────────────────────────────────────
cat > src/main.jsx << 'MAIN'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
MAIN

# ── src/App.jsx ───────────────────────────────────────────────
cat > src/App.jsx << 'APP'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import BrowseEventsPage from './pages/BrowseEventsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* App shell */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="events" element={<BrowseEventsPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
APP

# ── src/lib/api.js ────────────────────────────────────────────
cat > src/lib/api.js << 'API'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
API

# ── src/lib/auth.js ───────────────────────────────────────────
cat > src/lib/auth.js << 'AUTH'
// JWT helpers — no external dependency needed for reading claims
export function saveToken(token) {
  localStorage.setItem('token', token)
}

export function getToken() {
  return localStorage.getItem('token')
}

export function removeToken() {
  localStorage.removeItem('token')
}

export function parseToken(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const payload = parseToken(token)
  if (!payload?.exp) return true
  return Date.now() / 1000 > payload.exp
}
AUTH

# ── src/contexts/AuthContext.jsx ──────────────────────────────
cat > src/contexts/AuthContext.jsx << 'CTX'
import { createContext, useContext, useState, useEffect } from 'react'
import api from '../lib/api'
import { saveToken, removeToken, getToken, isTokenExpired } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)      // Current user object from /api/auth/me
  const [loading, setLoading] = useState(true) // True while fetching initial user

  // On mount: if valid token exists, fetch current user
  useEffect(() => {
    const token = getToken()
    if (token && !isTokenExpired(token)) {
      api.get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => removeToken())
        .finally(() => setLoading(false))
    } else {
      removeToken()
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    // POST /api/auth/login — Member 3's endpoint
    const res = await api.post('/auth/login', { email, password })
    saveToken(res.data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  async function register(data) {
    // POST /api/auth/register — Member 3's endpoint
    const res = await api.post('/auth/register', data)
    saveToken(res.data.access_token)
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  function logout() {
    removeToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
CTX

# ── src/components/layout/Sidebar.jsx ────────────────────────
cat > src/components/layout/Sidebar.jsx << 'SIDEBAR'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import styles from './Sidebar.module.css'

const NAV = [
  { to: '/dashboard',      label: 'Dashboard' },
  { to: '/events',         label: 'Browse Events' },
  { to: '/registrations',  label: 'My Registrations' },
  { to: '/tickets',        label: 'My Tickets' },
  { to: '/feedback',       label: 'Feedback' },
  { to: '/preferences',    label: 'Preferences' },
]

export default function Sidebar() {
  const { user } = useAuth()
  const role = user?.roles?.[0] ?? 'Attendee'

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoText}>Teq<span>Event</span></span>
      </div>

      <nav className={styles.nav}>
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [styles.navItem, isActive ? styles.active : ''].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.roleBadge}>
          <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
          <span className={styles.chevron}>⌄</span>
        </div>
      </div>
    </aside>
  )
}
SIDEBAR

cat > src/components/layout/Sidebar.module.css << 'SIDEBARCSS'
.sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.logo {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.logoText {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--text-primary);
}

.logoText span {
  color: var(--text-secondary);
}

.nav {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.navItem {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-size: 13.5px;
  color: var(--text-secondary);
  border-left: 2px solid transparent;
  transition: background 0.12s, color 0.12s;
}

.navItem:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

.active {
  color: var(--text-primary);
  border-left-color: var(--text-primary);
  background: var(--bg-card-hover);
}

.footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
}

.roleBadge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-btn);
  padding: 7px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.chevron {
  font-size: 10px;
  color: var(--text-muted);
}
SIDEBARCSS

# ── src/components/layout/Topbar.jsx ─────────────────────────
cat > src/components/layout/Topbar.jsx << 'TOPBAR'
import styles from './Topbar.module.css'

export default function Topbar({ title }) {
  return (
    <header className={styles.topbar}>
      <span className={styles.title}>{title}</span>
      <div className={styles.actions}>
        <button className={styles.iconBtn} title="Notifications">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1a5 5 0 0 1 5 5c0 3.5-1.5 5-5 7C5.5 11 3 9.5 3 6a5 5 0 0 1 5-5z"/>
            <circle cx="8" cy="14.5" r="0.8" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button className={styles.iconBtn} title="Profile">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="5" r="3"/>
            <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
          </svg>
        </button>
      </div>
    </header>
  )
}
TOPBAR

cat > src/components/layout/Topbar.module.css << 'TOPBARCSS'
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 10;
}

.title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.iconBtn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--border);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: background 0.12s, color 0.12s;
}

.iconBtn:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}
TOPBARCSS

# ── src/components/layout/Layout.jsx ─────────────────────────
cat > src/components/layout/Layout.jsx << 'LAYOUT'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from './Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  )
}
LAYOUT

cat > src/components/layout/Layout.module.css << 'LAYOUTCSS'
.shell {
  display: flex;
  min-height: 100vh;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
LAYOUTCSS

# ── src/components/ui/EventCard.jsx ──────────────────────────
cat > src/components/ui/EventCard.jsx << 'ECARD'
import styles from './EventCard.module.css'

export default function EventCard({ event }) {
  const { title, date, location_type, physical_address, ticket_tier, spots_left, cover_image } = event

  return (
    <div className={styles.card}>
      <div className={styles.imgWrap}>
        {cover_image
          ? <img src={cover_image} alt={title} className={styles.img} />
          : <div className={styles.imgPlaceholder} />
        }
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        <div className={styles.meta}>
          <span>{date}</span>
        </div>
        <div className={styles.meta}>
          <span className={styles.tag}>{location_type}</span>
          {physical_address && (
            <span className={styles.tag}>{physical_address}</span>
          )}
        </div>
        <div className={styles.footer}>
          <span className={styles.tierName}>{ticket_tier ?? '—'}</span>
          {spots_left != null && (
            <span className={styles.spots}>{spots_left} spots left</span>
          )}
        </div>
      </div>
    </div>
  )
}
ECARD

cat > src/components/ui/EventCard.module.css << 'ECARDCSS'
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
}

.card:hover { border-color: var(--border-hover); }

.imgWrap { width: 100%; height: 110px; overflow: hidden; }

.img { width: 100%; height: 100%; object-fit: cover; display: block; }

.imgPlaceholder {
  width: 100%;
  height: 100%;
  background: var(--bg-card-hover);
}

.body { padding: 12px; }

.title {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  line-height: 1.35;
  color: var(--text-primary);
}

.meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 10.5px;
  color: var(--text-secondary);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px solid var(--border);
}

.tierName { font-size: 11px; color: var(--text-muted); }
.spots    { font-size: 11px; color: var(--text-secondary); }
ECARDCSS

# ── src/pages/DashboardPage.jsx ───────────────────────────────
cat > src/pages/DashboardPage.jsx << 'DASH'
import Topbar from '../components/layout/Topbar'
import EventCard from '../components/ui/EventCard'
import { useAuth } from '../contexts/AuthContext'
import styles from './DashboardPage.module.css'

// ── Fake data — swap for api.get('/events') when backend is ready ──
const UPCOMING = [
  {
    id: 1,
    title: 'AI & Machine Learning Summit 2026',
    date: 'April 15, 2026',
    location_type: 'Online',
    ticket_tier: 'VIP Pass',
    spots_left: 45,
  },
  {
    id: 2,
    title: 'Global Tech Conference',
    date: 'May 8, 2026',
    location_type: 'Physical',
    physical_address: 'San Francisco, CA',
    ticket_tier: 'Early Bird',
    spots_left: 120,
  },
  {
    id: 3,
    title: 'Startup Ecosystem Workshop',
    date: 'June 2, 2026',
    location_type: 'Hybrid',
    ticket_tier: 'Standard',
    spots_left: 32,
  },
]

const RECOMMENDED = [
  {
    id: 4,
    title: 'Code & Hardware Expo',
    date: 'Jul 14, 2026',
    reason: 'Based on your history',
    location_type: 'Physical',
  },
  {
    id: 5,
    title: 'Mathematical Workshop',
    date: 'Aug 3, 2026',
    reason: 'Popular in category',
    location_type: 'Online',
  },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.first_name ?? 'Alex'

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className={styles.page}>
      <Topbar title="Dashboard" />
      <div className={styles.content}>
        <h1 className={styles.greeting}>{greeting}, {firstName}</h1>

        <section>
          <p className={styles.sectionTitle}>Your Upcoming Events</p>
          <div className={styles.grid3}>
            {UPCOMING.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>

        <section>
          <p className={styles.sectionTitle}>AI Recommended Events</p>
          <div className={styles.grid2}>
            {RECOMMENDED.map((e) => (
              <div key={e.id} className={styles.recCard}>
                <div className={styles.recImg} />
                <span className={styles.recBadge}>Recommended</span>
                <div className={styles.recBody}>
                  <p className={styles.recTitle}>{e.title}</p>
                  <p className={styles.recSub}>{e.reason} · {e.date}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
DASH

cat > src/pages/DashboardPage.module.css << 'DASHCSS'
.page { display: flex; flex-direction: column; flex: 1; }

.content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.greeting {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.sectionTitle {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 14px;
}

.grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.grid2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.recCard {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  transition: border-color 0.15s;
}

.recCard:hover { border-color: var(--border-hover); }

.recImg {
  width: 100%;
  height: 90px;
  background: var(--bg-card-hover);
}

.recBadge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: #e7e9ec;
  color: var(--bg-primary);
  font-size: 10px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 4px;
}

.recBody { padding: 10px 12px; }

.recTitle {
  font-size: 12.5px;
  font-weight: 500;
  margin-bottom: 4px;
}

.recSub { font-size: 11px; color: var(--text-secondary); }
DASHCSS

# ── src/pages/BrowseEventsPage.jsx ───────────────────────────
cat > src/pages/BrowseEventsPage.jsx << 'BROWSE'
import Topbar from '../components/layout/Topbar'
import EventCard from '../components/ui/EventCard'
import styles from './BrowseEventsPage.module.css'

// TODO: replace with api.get('/events') when Member 1's Events API is merged
const ALL_EVENTS = [
  { id: 1, title: 'AI & Machine Learning Summit 2026', date: 'April 15, 2026', location_type: 'Online',    ticket_tier: 'VIP Pass',   spots_left: 45 },
  { id: 2, title: 'Global Tech Conference',            date: 'May 8, 2026',    location_type: 'Physical', physical_address: 'San Francisco, CA', ticket_tier: 'Early Bird', spots_left: 120 },
  { id: 3, title: 'Startup Ecosystem Workshop',        date: 'June 2, 2026',   location_type: 'Hybrid',   ticket_tier: 'Standard',   spots_left: 32 },
  { id: 4, title: 'Code & Hardware Expo',              date: 'Jul 14, 2026',   location_type: 'Physical', ticket_tier: 'General',    spots_left: 80 },
  { id: 5, title: 'Mathematical Workshop',             date: 'Aug 3, 2026',    location_type: 'Online',   ticket_tier: 'Free',       spots_left: null },
]

export default function BrowseEventsPage() {
  return (
    <div className={styles.page}>
      <Topbar title="Browse Events" />
      <div className={styles.content}>
        <input className="input" placeholder="Search events..." style={{ maxWidth: 320, marginBottom: 24 }} />
        <div className={styles.grid}>
          {ALL_EVENTS.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      </div>
    </div>
  )
}
BROWSE

cat > src/pages/BrowseEventsPage.module.css << 'BROWSECSS'
.page { display: flex; flex-direction: column; flex: 1; }
.content { flex: 1; overflow-y: auto; padding: 28px 24px; }
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
BROWSECSS

# ── src/pages/LoginPage.jsx ───────────────────────────────────
cat > src/pages/LoginPage.jsx << 'LOGIN'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './AuthPage.module.css'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>TeqEvent</div>
        <h1 className={styles.heading}>Sign in</h1>
        {error && <p className={styles.error}>{error}</p>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '9px' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className={styles.switch}>
          No account? <a href="/register">Register</a>
        </p>
      </div>
    </div>
  )
}
LOGIN

# ── src/pages/RegisterPage.jsx ────────────────────────────────
cat > src/pages/RegisterPage.jsx << 'REG'
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
REG

cat > src/pages/AuthPage.module.css << 'AUTHCSS'
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.card {
  width: 100%;
  max-width: 360px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 32px 28px;
}

.logo {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 24px;
  letter-spacing: -0.2px;
}

.heading {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.4px;
  margin-bottom: 20px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error {
  font-size: 12.5px;
  color: #f87171;
  margin-bottom: 12px;
  padding: 8px 10px;
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: var(--radius-btn);
}

.switch {
  margin-top: 16px;
  font-size: 12.5px;
  color: var(--text-secondary);
  text-align: center;
}

.switch a {
  color: var(--text-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
AUTHCSS

# ── 5. Remove Vite boilerplate ────────────────────────────────
echo "  [5/6] Cleaning Vite boilerplate..."
rm -f src/App.css
rm -f public/vite.svg
rm -f src/assets/react.svg

# ── 6. Done ───────────────────────────────────────────────────
echo "  [6/6] Done."
echo ""
echo "  ✓ All files written."
echo ""
echo "  Next steps:"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Then open: http://localhost:5173"
echo ""
echo "  When ready to push:"
echo "    git checkout -b feature/IEM-frontend-setup"
echo "    git add ."
echo "    git commit -m 'IEM-XX Frontend scaffold — React + Vite + design system'"
echo "    git push origin feature/IEM-frontend-setup"
echo ""