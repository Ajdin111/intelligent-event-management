import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ─── Config ─────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in your .env file.
// On Android emulator use http://10.0.2.2:8000
// On iOS simulator use http://localhost:8000
// On a physical device use your machine's local IP: http://192.168.x.x:8000
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'http://localhost:8000';

export const TOKEN_KEY = 'teqevent_token';

// ─── Axios instance ──────────────────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
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

// ─── User types ──────────────────────────────────────────────────────────────
// Mirrors the backend User model exactly.
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_organizer: boolean;
  is_admin: boolean;
  bio?: string;
  profile_picture?: string;
  created_at: string;
}

// Derived helper — maps backend flags to a single role string for nav logic.
export type UserRole = 'admin' | 'organizer' | 'attendee';
export function getUserRole(user: User): UserRole {
  if (user.is_admin) return 'admin';
  if (user.is_organizer) return 'organizer';
  return 'attendee';
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/api/auth/login', data),

  register: (data: RegisterPayload) =>
    api.post<AuthResponse>('/api/auth/register', data),

  me: () =>
    api.get<User>('/api/auth/me'),
};

// ─── Events ──────────────────────────────────────────────────────────────────
export interface Event {
  id: number;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  location_type: 'physical' | 'online' | 'hybrid';
  physical_address?: string;
  online_link?: string;
  capacity?: number;
  status: 'draft' | 'published' | 'cancelled';
  registration_type: 'automatic' | 'manual' | 'invite_only';
  owner_id: number;
  cover_image?: string;
  is_free: boolean;
  has_ticketing: boolean;
  requires_registration: boolean;
  feedback_visibility: 'public' | 'organizer_only';
  created_at: string;
  updated_at: string;
  category_ids: number[];
}


export interface EventsParams {
  skip?: number;
  limit?: number;
  category_id?: number;
  search?: string;
  status?: string;
  location_type?: string;
}

export const eventsApi = {
  list: (params?: EventsParams) =>
    api.get<{ items: Event[]; total: number; skip: number; limit: number }>(
      '/api/events',
      { params },
    ),

  detail: (id: number) =>
    api.get<Event>(`/api/events/${id}`),

  myEvents: () =>
    api.get<Event[]>('/api/events/my-events'),

  create: (data: Partial<Event>) =>
    api.post<Event>('/api/events', data),

  update: (id: number, data: Partial<Event>) =>
    api.patch<Event>(`/api/events/${id}`, data),

  publish: (id: number) =>
    api.patch<Event>(`/api/events/${id}/publish`),

  delete: (id: number) =>
    api.delete(`/api/events/${id}`),

  analytics: (id: number) =>
    api.get(`/api/events/${id}/analytics`),

  categories: () =>
    api.get('/api/categories'),

  ticketTiers: (eventId: number) =>
    api.get(`/api/events/${eventId}/ticket-tiers`),
};

// ─── Registrations ───────────────────────────────────────────────────────────
export interface Registration {
  id: number;
  event_id: number;
  user_id: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'rejected';
  quantity: number;
  total_amount: string;
  registered_at: string;
  ticket_tier_id?: number;
}

export interface RegistrationCreatePayload {
  event_id: number;
  ticket_tier_id?: number;
  quantity?: number;
  promo_code?: string;
}

export const registrationsApi = {
  register: (data: RegistrationCreatePayload) =>
    api.post<Registration>('/api/registrations', data),

  myRegistrations: () =>
    api.get<Registration[]>('/api/registrations/me'),

  detail: (id: number) =>
    api.get<Registration>(`/api/registrations/${id}`),

  cancel: (id: number, reason?: string) =>
    api.delete<Registration>(`/api/registrations/${id}`, {
      data: { reason },
    }),

  tickets: (registrationId: number) =>
    api.get<Ticket[]>(`/api/registrations/${registrationId}/tickets`),

  // Organizer: list all registrations for an event
  eventRegistrations: (eventId: number, params?: { skip?: number; limit?: number }) =>
    api.get(`/api/events/${eventId}/registrations`, { params }),

  approve: (id: number) =>
    api.patch(`/api/registrations/${id}/approve`),

  reject: (id: number, reason: string) =>
    api.patch(`/api/registrations/${id}/reject`, { reason }),
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
export interface Ticket {
  id: number;
  registration_id: number;
  event_id: number;
  qr_code: string;
  is_valid: boolean;
  issued_at: string;
}

// ─── Check-in ────────────────────────────────────────────────────────────────
export interface CheckInResult {
  id: number;
  registration_id: number;
  ticket_id: number;
  event_id: number;
  checked_in_by: number;
  checked_in_at: string;
  is_manual: boolean;
}

export interface CheckInStatsResult {
  event_id: number;
  total_registered: number;
  total_checked_in: number;
  attendance_rate: number;
  remaining: number;
}

export interface OfflineCheckInItem {
  qr_code: string;
  event_id: number;
  scanned_at: string; // ISO timestamp
}

export const checkinApi = {
  // QR scan check-in — field is qr_code (not qr_data)
  scanQR: (qr_code: string, event_id: number) =>
    api.post<CheckInResult>('/api/checkin/qr', { qr_code, event_id }),

  // Manual check-in by registration ID
  manual: (registration_id: number, event_id: number) =>
    api.post<CheckInResult>('/api/checkin/manual', { registration_id, event_id }),

  // Sync offline queue — field is items (not records)
  syncOffline: (items: OfflineCheckInItem[]) =>
    api.post('/api/checkin/offline/sync', { items }),

  // Stats endpoint: /api/checkin/{eventId}/stats (not /stats/{eventId})
  stats: (eventId: number) =>
    api.get<CheckInStatsResult>(`/api/checkin/${eventId}/stats`),

  listCheckins: (eventId: number, params?: { skip?: number; limit?: number }) =>
    api.get(`/api/checkin/${eventId}`, { params }),
};

// ─── Notifications ───────────────────────────────────────────────────────────
export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  event_id?: number;
}

export const notificationsApi = {
  list: () =>
    api.get<Notification[]>('/api/notifications/'),

  unreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread-count'),

  markRead: (id: number) =>
    api.patch(`/api/notifications/${id}/read`),

  markAllRead: () =>
    api.patch('/api/notifications/read-all'),

  preferences: () =>
    api.get('/api/notifications/preferences'),

  updatePreferences: (data: Record<string, boolean>) =>
    api.patch('/api/notifications/preferences', data),
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
export interface Review {
  id: number;
  event_id: number;
  user_id: number;
  rating: number;
  comment?: string;
  sentiment?: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewPayload {
  event_id: number;
  rating: number;
  comment?: string;
  is_anonymous?: boolean;
}

export const reviewsApi = {
  // Route is /api/events/{id}/reviews — not /api/reviews/event/{id}
  eventReviews: (eventId: number) =>
    api.get<Review[]>(`/api/events/${eventId}/reviews`),

  submit: (data: ReviewPayload) =>
    api.post<Review>('/api/reviews', data),

  update: (eventId: number, data: Partial<ReviewPayload>) =>
    api.patch<Review>(`/api/reviews/${eventId}`, data),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  // Route is /api/admin/analytics — not /api/admin/stats
  analytics: () =>
    api.get('/api/admin/analytics'),

  users: (params?: { skip?: number; limit?: number; search?: string }) =>
    api.get('/api/admin/users', { params }),

  getUser: (id: number) =>
    api.get(`/api/admin/users/${id}`),

  allEvents: (params?: { skip?: number; limit?: number; status?: string }) =>
    api.get('/api/admin/events', { params }),

  deactivateUser: (id: number) =>
    api.patch(`/api/admin/users/${id}/deactivate`),

  activateUser: (id: number) =>
    api.patch(`/api/admin/users/${id}/activate`),

  deleteUser: (id: number) =>
    api.delete(`/api/admin/users/${id}`),

  unpublishEvent: (id: number) =>
    api.patch(`/api/admin/events/${id}/unpublish`),

  deleteEvent: (id: number) =>
    api.delete(`/api/admin/events/${id}`),
};

export default api;
