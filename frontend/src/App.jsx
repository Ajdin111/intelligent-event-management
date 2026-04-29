import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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

function NotFoundRoute() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-text">
          The page you requested does not exist or may have been moved.
        </p>
        <a href="/dashboard" className="not-found-link">
          Back to dashboard
        </a>
      </div>
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
            <Route path="profile" element={<Preferences />} />
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

          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
