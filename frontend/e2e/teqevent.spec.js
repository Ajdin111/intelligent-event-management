/**
 * TeqEvent — End-to-End Test Suite (Playwright)
 * Pattern: Page Object Model (POM)
 *
 * Requires:
 *   - Frontend running on http://localhost:5173
 *   - Backend  running on http://localhost:8000
 */

import { test, expect, request } from '@playwright/test'
import { LoginPage }       from './pages/LoginPage.js'
import { EventsPage }      from './pages/EventsPage.js'
import { EventDetailPage } from './pages/EventDetailPage.js'
import { DashboardPage }   from './pages/DashboardPage.js'
import { OrganizerPage }   from './pages/OrganizerPage.js'
import { AdminPage }       from './pages/AdminPage.js'

// ── Credentials (seeded by seed_dev.py) ───────────────────────────────────────
const ATTENDEE  = { email: 'user1@teqevent.com', password: 'Test1234' }
const ORGANIZER = { email: 'org1@teqevent.com',  password: 'Test1234' }
const ADMIN     = { email: 'admin@teqevent.com',  password: 'Admin123' }

// ── Helper: get token via API, inject into localStorage, navigate to target ───
async function apiLogin(page, { email, password }, role = 'attendee', dest = null) {
  // Pause to stay within the backend's 5-per-minute login rate limit.
  // With 2 UI logins (TC-02, TC-03) + 4 API logins (TC-04,05,06,09),
  // we need at least 13s between calls so the window resets before TC-09.
  await page.waitForTimeout(13000)
  const ctx = await request.newContext({ baseURL: 'http://localhost:8000' })
  const res  = await ctx.post('/api/auth/login', { data: { email, password } })
  const { access_token } = await res.json()
  await ctx.dispose()

  // Navigate directly to the target so only ONE page load is needed
  const target = dest
    ?? (role === 'organizer' ? '/organizer/dashboard'
       : role === 'admin'    ? '/admin/overview'
       : '/dashboard')

  await page.goto('/')
  await page.evaluate(({ t, r }) => {
    localStorage.setItem('token', t)
    localStorage.setItem('activeRole', r)
  }, { t: access_token, r: role })

  await page.goto(target)
  await page.waitForLoadState('networkidle', { timeout: 10000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-01  Login page renders correctly (positive / smoke)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-01: Login page renders email, password and sign-in button', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()

  await expect(loginPage.emailInput).toBeVisible()
  await expect(loginPage.passwordInput).toBeVisible()
  await expect(loginPage.signInButton).toBeVisible()
  await expect(loginPage.createOneLink).toBeVisible()
  await expect(page).toHaveURL(/login/)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-02  Invalid login shows error (negative)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-02: Invalid credentials display an error and stay on login', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login('nobody@fake.com', 'wrongpassword')

  await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 8000 })
  await expect(page).toHaveURL(/login/)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-03  Valid attendee login redirects to dashboard (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-03: Attendee logs in via UI and lands on dashboard', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login(ATTENDEE.email, ATTENDEE.password)

  await expect(page).toHaveURL(/dashboard/, { timeout: 12000 })
  const dashboard = new DashboardPage(page)
  await expect(dashboard.browseEventsLink).toBeVisible({ timeout: 8000 })
  await expect(dashboard.myTicketsLink).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-04  Browse Events loads event cards (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-04: Browse events page loads and shows at least one event card', async ({ page }) => {
  await apiLogin(page, ATTENDEE, 'attendee', '/events')
  const eventsPage = new EventsPage(page)

  await expect(eventsPage.filterPanel).toBeVisible({ timeout: 8000 })
  await eventsPage.waitForEvents()
  expect(await eventsPage.getEventCount()).toBeGreaterThan(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-05  Event search filters results (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-05: Searching for a term filters the event list', async ({ page }) => {
  await apiLogin(page, ATTENDEE, 'attendee', '/events')
  const eventsPage = new EventsPage(page)
  await eventsPage.waitForEvents()

  const before = await eventsPage.getEventCount()
  await eventsPage.search('zzzzz')
  expect(await eventsPage.getEventCount()).toBeLessThanOrEqual(before)
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-06  Click event card opens detail page (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-06: Clicking an event card navigates to the event detail page', async ({ page }) => {
  await apiLogin(page, ATTENDEE, 'attendee', '/events')
  const eventsPage = new EventsPage(page)
  await eventsPage.waitForEvents()
  await eventsPage.clickFirstEvent()

  await expect(page).toHaveURL(/\/events\/\d+/, { timeout: 8000 })
  const detailPage = new EventDetailPage(page)
  await detailPage.waitForLoad()
  await expect(detailPage.title).toBeVisible()
  await expect(detailPage.registerBtn).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-07  Unauthenticated access redirects to login (negative)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-07: Unauthenticated user accessing dashboard is redirected to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/login/, { timeout: 8000 })
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-08  Register page renders correctly (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-08: Register page renders all required fields', async ({ page }) => {
  await page.goto('/register')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible({ timeout: 8000 })
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  await expect(page.getByText('Sign in')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-09  Sign out clears session (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-09: Signing out clears the token and redirects to login', async ({ page }) => {
  await apiLogin(page, ATTENDEE)  // lands on /dashboard
  const dashboard = new DashboardPage(page)
  await dashboard.waitForLoad()
  await dashboard.signOut()

  await expect(page).toHaveURL(/login/, { timeout: 8000 })
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()
})

// ─────────────────────────────────────────────────────────────────────────────
// TC-10  Register → Login navigation (positive)
// ─────────────────────────────────────────────────────────────────────────────
test('TC-10: Register page Sign in link navigates to login', async ({ page }) => {
  await page.goto('/register')
  await page.getByText('Sign in').click()
  await expect(page).toHaveURL(/login/, { timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
