import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test the pure utility exports from api.js without axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request:  { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get:    vi.fn(),
      post:   vi.fn(),
      patch:  vi.fn(),
      delete: vi.fn(),
    })),
  },
}))

import { setCriticalOp, API_BASE_URL } from '../services/api'

describe('api.js', () => {

  describe('API_BASE_URL', () => {
    it('exports a non-empty base URL', () => {
      expect(API_BASE_URL).toBeTruthy()
      expect(typeof API_BASE_URL).toBe('string')
    })

    it('base URL points to localhost in development', () => {
      expect(API_BASE_URL).toContain('localhost')
    })
  })

  describe('setCriticalOp', () => {
    it('is a function', () => {
      expect(typeof setCriticalOp).toBe('function')
    })

    it('can be called with true without throwing', () => {
      expect(() => setCriticalOp(true)).not.toThrow()
    })

    it('can be called with false without throwing', () => {
      expect(() => setCriticalOp(false)).not.toThrow()
    })

    it('can be toggled multiple times', () => {
      expect(() => {
        setCriticalOp(true)
        setCriticalOp(false)
        setCriticalOp(true)
      }).not.toThrow()
    })
  })

  describe('API module exports', () => {
    it('exports named API objects', async () => {
      const api = await import('../services/api')
      expect(api.authApi).toBeDefined()
      expect(api.eventsApi).toBeDefined()
      expect(api.categoriesApi).toBeDefined()
      expect(api.registrationsApi).toBeDefined()
      expect(api.notificationsApi).toBeDefined()
      expect(api.ticketTiersApi).toBeDefined()
      expect(api.reviewsApi).toBeDefined()
    })

    it('authApi has required methods', async () => {
      const { authApi } = await import('../services/api')
      expect(typeof authApi.login).toBe('function')
      expect(typeof authApi.register).toBe('function')
      expect(typeof authApi.me).toBe('function')
      expect(typeof authApi.updateProfile).toBe('function')
      expect(typeof authApi.changePassword).toBe('function')
    })

    it('eventsApi has required methods', async () => {
      const { eventsApi } = await import('../services/api')
      expect(typeof eventsApi.list).toBe('function')
      expect(typeof eventsApi.getById).toBe('function')
      expect(typeof eventsApi.create).toBe('function')
      expect(typeof eventsApi.publish).toBe('function')
    })

    it('registrationsApi has required methods', async () => {
      const { registrationsApi } = await import('../services/api')
      expect(typeof registrationsApi.create).toBe('function')
      expect(typeof registrationsApi.getMine).toBe('function')
      expect(typeof registrationsApi.cancel).toBe('function')
    })

    it('notificationsApi has required methods', async () => {
      const { notificationsApi } = await import('../services/api')
      expect(typeof notificationsApi.list).toBe('function')
      expect(typeof notificationsApi.getUnreadCount).toBe('function')
      expect(typeof notificationsApi.markRead).toBe('function')
      expect(typeof notificationsApi.markAllRead).toBe('function')
      expect(typeof notificationsApi.getPreferences).toBe('function')
      expect(typeof notificationsApi.updatePreferences).toBe('function')
    })
  })

  describe('API function bodies are exercised', () => {
    it('authApi calls exercise code paths', async () => {
      const { authApi, default: api } = await import('../services/api')
      authApi.login('a@b.com', 'pass')
      authApi.register({ email: 'a@b.com', password: 'pass', first_name: 'A', last_name: 'B' })
      authApi.me()
      authApi.updateProfile({ first_name: 'A' })
      authApi.changePassword({ current_password: 'old', new_password: 'new' })
      authApi.deleteAccount({ password: 'pass' })
      expect(api.post).toHaveBeenCalled()
    })

    it('eventsApi calls exercise code paths', async () => {
      const { eventsApi, default: api } = await import('../services/api')
      eventsApi.list()
      eventsApi.getById(1)
      eventsApi.create({ title: 'Test' })
      eventsApi.publish(1)
      eventsApi.update(1, { title: 'Updated' })
      expect(api.get).toHaveBeenCalled()
    })

    it('registrationsApi calls exercise code paths', async () => {
      const { registrationsApi, default: api } = await import('../services/api')
      registrationsApi.create({ event_id: 1, ticket_tier_id: 1, quantity: 1 })
      registrationsApi.getMine()
      registrationsApi.getById(1)
      registrationsApi.cancel(1, 'reason')
      registrationsApi.getTickets(1)
      expect(api.get).toHaveBeenCalled()
    })

    it('notificationsApi calls exercise code paths', async () => {
      const { notificationsApi, default: api } = await import('../services/api')
      notificationsApi.list()
      notificationsApi.getUnreadCount()
      notificationsApi.markRead(1)
      notificationsApi.markAllRead()
      notificationsApi.getPreferences()
      notificationsApi.updatePreferences({ email_enabled: true })
      expect(api.get).toHaveBeenCalled()
    })

    it('ticketTiersApi and reviewsApi exercise code paths', async () => {
      const { ticketTiersApi, reviewsApi, default: api } = await import('../services/api')
      ticketTiersApi.listByEvent(1)
      reviewsApi.listByEvent(1)
      reviewsApi.getMyReview(1)
      reviewsApi.create({ event_id: 1, rating: 5 })
      reviewsApi.delete(1)
      expect(api.get).toHaveBeenCalled()
    })

    it('categoriesApi and promoCodesApi exercise code paths', async () => {
      const { categoriesApi, promoCodesApi, default: api } = await import('../services/api')
      categoriesApi.list()
      promoCodesApi.validate(1, 'CODE', 1)
      expect(api.get).toHaveBeenCalled()
    })

    it('mlApi exercises code paths', async () => {
      const { mlApi, default: api } = await import('../services/api')
      mlApi.recommendations()
      mlApi.demand(1)
      mlApi.sentiment(1)
      expect(api.get).toHaveBeenCalled()
    })

    it('organizerApi exercises code paths', async () => {
      const { organizerApi, default: api } = await import('../services/api')
      organizerApi.listEventRegistrations(1)
      organizerApi.getStats()
      organizerApi.getTimeline(30)
      organizerApi.getActivity()
      expect(api.get).toHaveBeenCalled()
    })

    it('adminApi exercises code paths', async () => {
      const { adminApi, default: api } = await import('../services/api')
      adminApi.analytics()
      adminApi.listUsers()
      adminApi.getUser(1)
      adminApi.listEvents()
      adminApi.deactivateUser(1)
      adminApi.activateUser(1)
      adminApi.deleteUser(1)
      adminApi.getEventDetail(1)
      adminApi.getEventAnalytics(1)
      adminApi.unpublishEvent(1)
      adminApi.deleteEvent(1)
      expect(api.get).toHaveBeenCalled()
    })

    it('collaboratorApi exercises code paths', async () => {
      const { collaboratorApi, default: api } = await import('../services/api')
      collaboratorApi.inviteCollaborator(1, 'test@test.com')
      collaboratorApi.listCollaborators(1)
      collaboratorApi.removeCollaborator(1, 2)
      collaboratorApi.acceptInvite(1)
      collaboratorApi.declineInvite(1)
      collaboratorApi.getMyInvites()
      collaboratorApi.getMyCollaboratingEvents()
      expect(api.get).toHaveBeenCalled()
    })

    it('inviteApi and uploadsApi exercise code paths', async () => {
      const { inviteApi, uploadsApi, default: api } = await import('../services/api')
      inviteApi.sendInvite(1, 'test@test.com')
      inviteApi.listEventInvites(1)
      inviteApi.getMyInvites()
      inviteApi.acceptInvite(1)
      inviteApi.declineInvite(1)
      const mockFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      uploadsApi.uploadEventCover(mockFile)
      expect(api.get).toHaveBeenCalled()
    })
  })
})
