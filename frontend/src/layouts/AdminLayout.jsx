import { Outlet } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'

export default function AdminLayout() {
  return (
    <div className="app-layout">
      <AdminSidebar />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
