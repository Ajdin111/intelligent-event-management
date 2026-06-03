export class EventDetailPage {
  constructor(page) {
    this.page          = page
    this.title         = page.locator('h1.ed-title')
    this.registerBtn   = page.locator('.ed-register-btn')
    this.tierSection   = page.locator('.ed-ticket-box')
    this.reviewSection = page.locator('.ed-section').filter({ hasText: /reviews/i })
    this.backButton    = page.locator('.ed-back')
  }

  async waitForLoad() {
    await this.title.waitFor({ timeout: 8000 })
  }

  async getTitleText() {
    return this.title.textContent()
  }

  async clickRegister() {
    await this.registerBtn.click()
  }

  async goBack() {
    await this.backButton.click()
  }
}
