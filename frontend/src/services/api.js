import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

// When true, 401 errors will NOT trigger a global logout — the caller handles them inline.
let _criticalOpActive = false
export const setCriticalOp = (active) => { _criticalOpActive = active }

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // skip redirect if this is the login call itself failing (wrong password)
      const isAuthCall = error.config?.url?.startsWith('/api/auth/')
      if (!isAuthCall && !_criticalOpActive) {
        localStorage.removeItem('token')
        localStorage.removeItem('activeRole')
        window.dispatchEvent(new CustomEvent('auth:unauthorized'))
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),
  register: (data) =>
    api.post('/api/auth/register', data),
  me: () =>
    api.get('/api/auth/me'),
  updateProfile: (data) =>
    api.patch('/api/auth/me', data),
  changePassword: (data) =>
    api.post('/api/auth/change-password', data),
  deleteAccount: (data) =>
    api.delete('/api/auth/me', { data }),
}

export const eventsApi = {
  list:    (params = {}) => api.get('/api/events', { params }),
  getById: (id)          => api.get(`/api/events/${id}`),
  create:  (data)        => api.post('/api/events', data),
  update:  (id, data)    => api.patch(`/api/events/${id}`, data),
  publish: (id)          => api.patch(`/api/events/${id}/publish`),
}

export const ticketTiersApi = {
  listByEvent: (eventId) => api.get(`/api/events/${eventId}/ticket-tiers`),
}

export const promoCodesApi = {
  validate: (eventId, code, ticketTierId) =>
    api.post(`/api/events/${eventId}/promo-codes/validate`, { code, ticket_tier_id: ticketTierId }),
}

export const categoriesApi = {
  list: () => api.get('/api/categories'),
}

export const reviewsApi = {
  listByEvent: (eventId) => api.get(`/api/events/${eventId}/reviews`),
  getMyReview: (eventId) => api.get(`/api/events/${eventId}/reviews/me`),
  create:      (data)    => api.post('/api/reviews', data),
  delete:      (id)      => api.delete(`/api/reviews/${id}`),
}

export const registrationsApi = {
  create:  (data)           => api.post('/api/registrations', data),
  getMine: ()               => api.get('/api/registrations/me'),
  getById: (id)             => api.get(`/api/registrations/${id}`),
  cancel:  (id, reason)     => api.delete(`/api/registrations/${id}`, { data: { cancellation_reason: reason ?? null } }),
  getTickets: (id)          => api.get(`/api/registrations/${id}/tickets`),
}

export const agendaApi = {
  listTracks:   (eventId) => api.get(`/api/events/${eventId}/tracks`),
  listSessions: (eventId) => api.get(`/api/events/${eventId}/sessions`),
}

export const organizerApi = {
  listEventRegistrations: (eventId, params = {}) =>
    api.get(`/api/events/${eventId}/registrations`, { params }),
}

export const mlApi = {
  recommendations: () => api.get('/api/ml/recommendations'),
  demand:          (eventId) => api.get(`/api/ml/demand/${eventId}`),
  sentiment:       (eventId) => api.get(`/api/ml/sentiment/${eventId}`),
}

export const adminApi = {
  analytics: ()                  => api.get('/api/admin/analytics'),
  listUsers: (params = {})       => api.get('/api/admin/users', { params }),
  getUser:   (id)                => api.get(`/api/admin/users/${id}`),
  listEvents: (params = {})      => api.get('/api/admin/events', { params }),
  deactivateUser: (id)           => api.patch(`/api/admin/users/${id}/deactivate`),
  activateUser:   (id)           => api.patch(`/api/admin/users/${id}/activate`),
  deleteUser:     (id)           => api.delete(`/api/admin/users/${id}`),
  getEventDetail:    (id)         => api.get(`/api/admin/events/${id}`),
  getEventAnalytics: (id)         => api.get(`/api/admin/events/${id}/analytics`),
  unpublishEvent: (id)            => api.patch(`/api/admin/events/${id}/unpublish`),
  deleteEvent:    (id)            => api.delete(`/api/admin/events/${id}`),
}

export const notificationsApi = {
  list:              ()    => api.get('/api/notifications/'),
  getUnreadCount:    ()    => api.get('/api/notifications/unread-count'),
  markRead:          (id)  => api.patch(`/api/notifications/${id}/read`),
  markAllRead:       ()    => api.patch('/api/notifications/read-all'),
  getPreferences:    ()    => api.get('/api/notifications/preferences'),
  updatePreferences: (data)=> api.patch('/api/notifications/preferences', data),
}

export const collaboratorApi = {
  inviteCollaborator: (eventId, email) =>
    api.post(`/api/collaborators/events/${eventId}/invite`, { email }),

  listCollaborators: (eventId) =>
    api.get(`/api/collaborators/events/${eventId}`),

  removeCollaborator: (eventId, userId) =>
    api.delete(`/api/collaborators/events/${eventId}/remove/${userId}`),

  acceptInvite: (eventId) =>
    api.post(`/api/collaborators/events/${eventId}/accept`),

  declineInvite: (eventId) =>
    api.post(`/api/collaborators/events/${eventId}/decline`),

  getMyInvites: () =>
    api.get(`/api/collaborators/my/invites`),

  getMyCollaboratingEvents: () =>
    api.get(`/api/collaborators/my/events`),
};

export const inviteApi = {
  sendInvite: (eventId, email) =>
    api.post(`/api/events/${eventId}/invites`, { email }),
  listEventInvites: (eventId) =>
    api.get(`/api/events/${eventId}/invites`),
  getMyInvites: () =>
    api.get(`/api/invites/my`),
  acceptInvite: (eventId) =>
    api.post(`/api/invites/${eventId}/accept`),
  declineInvite: (eventId) =>
    api.post(`/api/invites/${eventId}/decline`),
}

export default api
