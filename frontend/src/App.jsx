import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import BrowseEvents from './pages/BrowseEvents'
import EventDetail from './pages/EventDetail'
import MyRegistrations from './pages/MyRegistrations'
import MyTickets from './pages/MyTickets'
import Feedback from './pages/Feedback'
import Preferences from './pages/Preferences'
import Login from './pages/Login'
import Register from './pages/Register'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
            <Route path="registrations" element={<MyRegistrations />} />
            <Route path="tickets" element={<MyTickets />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="preferences" element={<Preferences />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
