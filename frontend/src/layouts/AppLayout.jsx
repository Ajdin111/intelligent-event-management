import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'

export default function AppLayout() {
  const { activeRole } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (activeRole === 'organizer') {
    return <Navigate to="/organizer/dashboard" replace />
  }

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <TopBar onHamburger={() => setSidebarOpen(o => !o)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
