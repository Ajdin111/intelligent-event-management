import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="ed-state ed-state--center">
      <p className="ed-state-code">404</p>
      <p className="ed-state-msg">Page not found</p>
      <button
        className="reg-btn-secondary"
        style={{ marginTop: 20, maxWidth: 200 }}
        onClick={() => navigate('/events')}
      >
        Back to events
      </button>
    </div>
  )
}
