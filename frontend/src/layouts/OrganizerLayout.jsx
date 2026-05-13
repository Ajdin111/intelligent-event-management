import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import OrganizerSidebar from '../components/OrganizerSidebar'
import TopBar from '../components/TopBar'

export default function OrganizerLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <OrganizerSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <TopBar onHamburger={() => setSidebarOpen(o => !o)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
