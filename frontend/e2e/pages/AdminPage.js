export class AdminPage {
  constructor(page) {
    this.page         = page
    this.heading      = page.getByText('Platform overview')
    this.totalUsers   = page.getByText('TOTAL USERS')
    this.totalEvents  = page.getByText('TOTAL EVENTS')
  }

  async goto() {
    await this.page.goto('/admin/overview')
  }

  async waitForLoad() {
    await this.heading.waitFor({ timeout: 15000 })
  }
}
