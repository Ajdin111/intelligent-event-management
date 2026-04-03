import api from './api'

/**
 * Fetch all events (with optional query params like ?skip=0&limit=20)
 */
export async function getEvents(params = {}) {
  const { data } = await api.get('/events', { params })
  return data
}

/**
 * Fetch a single event by ID.
 */
export async function getEvent(id) {
  const { data } = await api.get(`/events/${id}`)
  return data
}

/**
 * Fetch events recommended for the current user (AI recommendations).
 */
export async function getRecommendedEvents() {
  const { data } = await api.get('/events/recommended')
  return data
}

/**
 * Fetch the current user's upcoming registered events.
 */
export async function getMyUpcomingEvents() {
  const { data } = await api.get('/events/my-upcoming')
  return data
}

/**
 * Register the current user for an event.
 */
export async function registerForEvent(eventId, ticketTypeId) {
  const { data } = await api.post(`/events/${eventId}/register`, { ticket_type_id: ticketTypeId })
  return data
}

/**
 * Cancel a registration.
 */
export async function cancelRegistration(registrationId) {
  const { data } = await api.delete(`/registrations/${registrationId}`)
  return data
}

/**
 * Submit feedback for an event.
 */
export async function submitFeedback(eventId, payload) {
  const { data } = await api.post(`/events/${eventId}/feedback`, payload)
  return data
}
