import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import styles from './Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <Outlet />
      </div>
    </div>
  )
}
