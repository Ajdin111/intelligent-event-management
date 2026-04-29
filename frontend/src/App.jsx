import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import OrganizerLayout from './layouts/OrganizerLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import BrowseEvents from './pages/BrowseEvents'
import EventDetail from './pages/EventDetail'
import RegisterEvent from './pages/RegisterEvent'
import MyRegistrations from './pages/MyRegistrations'
import MyTickets from './pages/MyTickets'
import Feedback from './pages/Feedback'
import Preferences from './pages/Preferences'
import Login from './pages/Login'
import Register from './pages/Register'
import OrganizerDashboard from './pages/organizer/OrganizerDashboard'
import CreateEvent from './pages/organizer/CreateEvent'
import ManageEvent from './pages/organizer/ManageEvent'
import OrganizerAnalytics from './pages/organizer/OrganizerAnalytics'
import OrganizerAgenda from './pages/organizer/OrganizerAgenda'
import OrganizerNotifications from './pages/organizer/OrganizerNotifications'
import NotFound from './pages/NotFound'

function Page404() {
  const { activeRole } = useAuth()
  const dashboardPath = activeRole === 'organizer' ? '/organizer/dashboard' : '/dashboard'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, textAlign: 'center', padding: '0 24px', background: 'rgb(26,31,34)' }}>
      <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, color: 'rgba(255,255,255,0.08)', lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Page not found</h1>
      <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.5)', maxWidth: 320, margin: 0 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <a href={dashboardPath} style={{ marginTop: 8, padding: '8px 20px', background: '#fff', color: 'rgb(26,31,34)', borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
        Go to dashboard
      </a>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Attendee routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="events" element={<BrowseEvents />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="events/:id/register" element={<RegisterEvent />} />
            <Route path="registrations" element={<MyRegistrations />} />
            <Route path="tickets" element={<MyTickets />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Organizer routes */}
          <Route
            path="/organizer"
            element={
              <ProtectedRoute requiredRole="organizer">
                <OrganizerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/organizer/dashboard" replace />} />
            <Route path="dashboard" element={<OrganizerDashboard />} />
            <Route path="create-event" element={<CreateEvent />} />
            <Route path="manage-event" element={<ManageEvent />} />
            <Route path="analytics" element={<OrganizerAnalytics />} />
            <Route path="agenda" element={<OrganizerAgenda />} />
            <Route path="notifications" element={<OrganizerNotifications />} />
          </Route>

          <Route path="*" element={<Page404 />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
