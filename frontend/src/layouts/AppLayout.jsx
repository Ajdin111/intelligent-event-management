import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function AppLayout() {
  const { activeRole } = useAuth()

  // If the user is currently in organizer mode, keep them in the organizer panel.
  // Prevents the attendee sidebar from showing while the topbar says "Organizer".
  if (activeRole === 'organizer') {
    return <Navigate to="/organizer/dashboard" replace />
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
