export class EventsPage {
  constructor(page) {
    this.page         = page
    this.filterPanel  = page.getByText('Filters')
    this.eventCards   = page.locator('.discover-card')
    this.searchInput  = page.getByPlaceholder(/search events/i)
    this.resetButton  = page.getByRole('button', { name: /reset/i })
  }

  async goto() {
    await this.page.goto('/events')
  }

  async waitForEvents() {
    await this.eventCards.first().waitFor({ timeout: 10000 })
  }

  async getEventCount() {
    return this.eventCards.count()
  }

  async search(term) {
    await this.searchInput.fill(term)
    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(500)
  }

  async clickFirstEvent() {
    await this.eventCards.first().click()
  }
}
