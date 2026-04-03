import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import BrowseEventsPage from './pages/BrowseEventsPage'
import EventDetailPage from './pages/EventDetailPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PreferencesPage from './pages/PreferencesPage'

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
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}