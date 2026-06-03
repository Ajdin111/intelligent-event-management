// Runs once before all tests — logs in each role and saves tokens to env vars.
// This prevents multiple login API calls during tests from hitting the 5/min rate limit.

import { request } from '@playwright/test'
import { writeFileSync } from 'fs'

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: 'http://localhost:8000' })

  const [attendeeRes, orgRes, adminRes] = await Promise.all([
    ctx.post('/api/auth/login', { data: { email: 'user1@teqevent.com', password: 'Test1234' } }),
    ctx.post('/api/auth/login', { data: { email: 'org1@teqevent.com',  password: 'Test1234' } }),
    ctx.post('/api/auth/login', { data: { email: 'admin@teqevent.com',  password: 'Admin123' } }),
  ])

  const tokens = {
    attendee:  (await attendeeRes.json()).access_token,
    organizer: (await orgRes.json()).access_token,
    admin:     (await adminRes.json()).access_token,
  }

  // Write to file — process.env doesn't propagate to Playwright workers
  writeFileSync('./e2e/.tokens.json', JSON.stringify(tokens))

  await ctx.dispose()
}
