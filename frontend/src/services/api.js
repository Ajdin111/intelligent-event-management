import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
})

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
      if (!isAuthCall) {
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
  list: (params = {}) => api.get('/api/events', { params }),
  getById: (id) => api.get(`/api/events/${id}`),
}

export const ticketTiersApi = {
  listByEvent: (eventId) => api.get(`/api/events/${eventId}/ticket-tiers`),
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

export const notificationsApi = {
  list: () => api.get('/api/notifications/'),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  getPreferences: () => api.get('/api/notifications/preferences'),
  updatePreferences: (data) => api.patch('/api/notifications/preferences', data),
}

export default api
