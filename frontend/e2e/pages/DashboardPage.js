export class DashboardPage {
  constructor(page) {
    this.page            = page
    this.browseEventsLink = page.getByText('Browse Events')
    this.myTicketsLink    = page.getByText('My Tickets')
    this.profileCard      = page.locator('.profile-card')
    this.profileDropdown  = page.locator('.profile-dropdown')
  }

  async goto() {
    await this.page.goto('/dashboard')
  }

  async waitForLoad() {
    await this.browseEventsLink.waitFor({ timeout: 8000 })
  }

  async openProfileDropdown() {
    await this.profileCard.click()
  }

  async signOut() {
    await this.openProfileDropdown()
    await this.profileDropdown.getByRole('button', { name: /sign out/i }).click()
  }
}
