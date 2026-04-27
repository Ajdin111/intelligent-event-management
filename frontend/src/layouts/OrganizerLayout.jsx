import { Outlet } from 'react-router-dom'
import OrganizerSidebar from '../components/OrganizerSidebar'
import TopBar from '../components/TopBar'

export default function OrganizerLayout() {
  return (
    <div className="app-layout">
      <OrganizerSidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
