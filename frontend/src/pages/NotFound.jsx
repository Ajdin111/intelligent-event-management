import { useNavigate, useLocation } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAdmin     = pathname.startsWith('/admin')
  const isOrganizer = pathname.startsWith('/organizer')

  const dest  = isAdmin ? '/admin/overview' : isOrganizer ? '/organizer/dashboard' : '/events'
  const label = isAdmin ? 'Back to overview' : isOrganizer ? 'Back to dashboard'   : 'Back to events'

  return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">404</p>
      <p className="ed-state-msg">Page not found</p>
      <button
        className="reg-btn-secondary"
        style={{ marginTop: 20, maxWidth: 200 }}
        onClick={() => navigate(dest)}
      >
        {label}
      </button>
    </div>
  )
}
