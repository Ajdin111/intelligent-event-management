import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import OrganizerLayout from './layouts/OrganizerLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import BrowseEvents from './pages/BrowseEvents'
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
            <Route path="registrations" element={<MyRegistrations />} />
            <Route path="tickets" element={<MyTickets />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="preferences" element={<Preferences />} />
          </Route>

          {/* Organizer routes */}
          <Route
            path="/organizer"
            element={
              <ProtectedRoute>
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

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
