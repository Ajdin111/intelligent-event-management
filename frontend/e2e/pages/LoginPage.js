export class LoginPage {
  constructor(page) {
    this.page = page
    this.emailInput    = page.getByPlaceholder('you@example.com')
    this.passwordInput = page.getByPlaceholder('••••••••')
    this.signInButton  = page.getByRole('button', { name: 'Sign in' })
    this.createOneLink = page.getByText('Create one')
    this.errorMessage  = page.locator('.auth-error, .auth-flash, [class*="error"]')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email, password) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.signInButton.click()
  }

  async waitForRedirect() {
    await this.page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 12000 })
  }

  async getErrorText() {
    return this.errorMessage.textContent()
  }
}
