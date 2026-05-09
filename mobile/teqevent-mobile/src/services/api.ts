import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ─── Config ─────────────────────────────────────────────────────────────────
// Change this to your machine's local IP when testing on a physical device.
// "localhost" won't work from a phone — use `ipconfig getifaddr en0` on Mac.
const BASE_URL = 'http://10.10.88.124:8000';

export const TOKEN_KEY = 'teqevent_token';
export const USER_KEY = 'teqevent_user';

// ─── Axios instance ──────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request automatically
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role?: 'attendee' | 'organizer';
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'attendee' | 'organizer' | 'admin';
  profile_picture?: string;
  bio?: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/api/auth/login', data),

  register: (data: RegisterPayload) =>
    api.post<AuthResponse>('/api/auth/register', data),

  me: () =>
    api.get<User>('/api/auth/me'),

  logout: () =>
    api.post('/api/auth/logout'),
};

// ─── Events ──────────────────────────────────────────────────────────────────
export interface Event {
  id: number;
  title: string;
  description: string;
  date: string;
  end_date?: string;
  location: string;
  category: string;
  image_url?: string;
  max_capacity: number;
  current_attendees: number;
  price: number;
  is_free: boolean;
  organizer_id: number;
  organizer_name?: string;
  tags?: string[];
  status: 'draft' | 'published' | 'cancelled' | 'completed';
}

export interface EventsParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  is_free?: boolean;
}

export const eventsApi = {
  list: (params?: EventsParams) =>
    api.get<{ events: Event[]; total: number; page: number }>('/api/events', { params }),

  featured: () =>
    api.get<Event[]>('/api/events/featured'),

  recommended: () =>
    api.get<Event[]>('/api/events/recommended'),

  detail: (id: number) =>
    api.get<Event>(`/api/events/${id}`),

  create: (data: Partial<Event>) =>
    api.post<Event>('/api/events', data),

  update: (id: number, data: Partial<Event>) =>
    api.put<Event>(`/api/events/${id}`, data),

  delete: (id: number) =>
    api.delete(`/api/events/${id}`),

  myEvents: () =>
    api.get<Event[]>('/api/events/my-events'),

  analytics: (id: number) =>
    api.get(`/api/events/${id}/analytics`),
};

// ─── Registrations ───────────────────────────────────────────────────────────
export interface Registration {
  id: number;
  event_id: number;
  user_id: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted';
  registered_at: string;
  ticket_type?: string;
  event?: Event;
}

export const registrationsApi = {
  register: (eventId: number, data?: { ticket_type?: string }) =>
    api.post<Registration>('/api/registrations', { event_id: eventId, ...data }),

  myRegistrations: () =>
    api.get<Registration[]>('/api/registrations/my-registrations'),

  cancel: (registrationId: number) =>
    api.delete(`/api/registrations/${registrationId}`),

  eventAttendees: (eventId: number) =>
    api.get(`/api/events/${eventId}/registrations`),
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
export interface Ticket {
  id: number;
  registration_id: number;
  qr_code: string;       // base64 QR image or raw string for QR generation
  qr_data: string;       // raw UUID / token to encode in QR
  event: Event;
  is_used: boolean;
  used_at?: string;
}

export const ticketsApi = {
  myTickets: () =>
    api.get<Ticket[]>('/api/tickets/my-tickets'),

  detail: (ticketId: number) =>
    api.get<Ticket>(`/api/tickets/${ticketId}`),
};

// ─── Check-in ────────────────────────────────────────────────────────────────
export interface CheckInResult {
  success: boolean;
  message: string;
  attendee_name?: string;
  event_title?: string;
  already_checked_in?: boolean;
}

export interface OfflineCheckIn {
  qr_data: string;
  scanned_at: string;         // ISO timestamp
  event_id: number;
}

export const checkinApi = {
  scanQR: (qrData: string, eventId?: number) =>
    api.post<CheckInResult>('/api/checkin/qr', { qr_data: qrData, event_id: eventId }),

  manual: (attendeeId: number, eventId: number) =>
    api.post<CheckInResult>('/api/checkin/manual', { attendee_id: attendeeId, event_id: eventId }),

  syncOffline: (records: OfflineCheckIn[]) =>
    api.post('/api/checkin/offline/sync', { records }),

  stats: (eventId: number) =>
    api.get(`/api/checkin/stats/${eventId}`),
};

// ─── Notifications ───────────────────────────────────────────────────────────
export interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  event_id?: number;
}

export const notificationsApi = {
  list: () =>
    api.get<Notification[]>('/api/notifications'),

  markRead: (id: number) =>
    api.patch(`/api/notifications/${id}/read`),

  markAllRead: () =>
    api.patch('/api/notifications/read-all'),

  send: (eventId: number, data: { title: string; body: string }) =>
    api.post(`/api/notifications/send`, { event_id: eventId, ...data }),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
export interface Review {
  id: number;
  event_id: number;
  user_id: number;
  rating: number;
  comment: string;
  created_at: string;
  user_name?: string;
}

export const reviewsApi = {
  eventReviews: (eventId: number) =>
    api.get<Review[]>(`/api/reviews/event/${eventId}`),

  submit: (data: { event_id: number; rating: number; comment: string }) =>
    api.post<Review>('/api/reviews', data),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () =>
    api.get('/api/admin/stats'),

  users: (params?: { page?: number; search?: string }) =>
    api.get('/api/admin/users', { params }),

  allEvents: (params?: { page?: number; status?: string }) =>
    api.get('/api/admin/events', { params }),

  deleteUser: (userId: number) =>
    api.delete(`/api/admin/users/${userId}`),
};

export default api;
