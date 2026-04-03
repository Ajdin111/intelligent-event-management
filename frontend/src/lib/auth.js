// JWT helpers — no external dependency needed for reading claims
export function saveToken(token) {
  localStorage.setItem('token', token)
}

export function getToken() {
  return localStorage.getItem('token')
}

export function removeToken() {
  localStorage.removeItem('token')
}

export function parseToken(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  const payload = parseToken(token)
  if (!payload?.exp) return true
  return Date.now() / 1000 > payload.exp
}
