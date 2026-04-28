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
}

export const eventsApi = {
  list: (params = {}) => api.get('/api/events', { params }),
  getById: (id) => api.get(`/api/events/${id}`),
  getTiers: (id) => api.get(`/api/events/${id}/ticket-tiers`),
}

export const categoriesApi = {
  list: () => api.get('/api/categories'),
}

export default api
