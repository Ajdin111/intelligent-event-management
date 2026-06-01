export class OrganizerPage {
  constructor(page) {
    this.page            = page
    this.heading         = page.getByText('Organizer overview')
    this.createEventLink = page.getByRole('link', { name: /create event/i }).first()
    this.totalEventsKpi  = page.getByText('TOTAL EVENTS')
  }

  async goto() {
    await this.page.goto('/organizer/dashboard')
  }

  async waitForLoad() {
    await this.heading.waitFor({ timeout: 8000 })
  }
}
