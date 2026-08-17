const SESSION_KEY = 'cortsme_session'
const LEGACY_TOKEN_KEY = 'cortsme_token'
const LEGACY_USER_KEY = 'cortsme_user'

export const SESSION_TTL_MS = 120 * 24 * 60 * 60 * 1000

function storage () {
  return typeof window !== 'undefined' ? window.localStorage : null
}

function decodeTokenExpiry (token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')))
    return Number(decoded.exp) > 0 ? Number(decoded.exp) * 1000 : null
  } catch {
    return null
  }
}

function cappedExpiry (token, now = Date.now()) {
  const retentionExpiry = now + SESSION_TTL_MS
  const tokenExpiry = decodeTokenExpiry(token)
  return tokenExpiry ? Math.min(retentionExpiry, tokenExpiry) : retentionExpiry
}

function validSession (value, now = Date.now()) {
  return Boolean(value?.token && value?.user && Number(value.expiresAt) > now)
}

export function clearStoredSession () {
  const target = storage()
  if (!target) return
  target.removeItem(SESSION_KEY)
  target.removeItem(LEGACY_TOKEN_KEY)
  target.removeItem(LEGACY_USER_KEY)
}

export function writeStoredSession ({ token, user, expiresAt }) {
  const target = storage()
  if (!target || !token || !user) return null
  const session = {
    token,
    user,
    expiresAt: Math.min(Number(expiresAt) || cappedExpiry(token), cappedExpiry(token))
  }
  target.setItem(SESSION_KEY, JSON.stringify(session))
  target.removeItem(LEGACY_TOKEN_KEY)
  target.removeItem(LEGACY_USER_KEY)
  return session
}

export function readStoredSession (now = Date.now()) {
  const target = storage()
  if (!target) return null

  try {
    const session = JSON.parse(target.getItem(SESSION_KEY) || 'null')
    if (validSession(session, now)) return session
    if (session) clearStoredSession()
  } catch {
    clearStoredSession()
  }

  // Migra uma sessão criada por versões anteriores sem alongar a validade do JWT.
  try {
    const token = target.getItem(LEGACY_TOKEN_KEY)
    const user = JSON.parse(target.getItem(LEGACY_USER_KEY) || 'null')
    if (!token || !user) return null
    const migrated = writeStoredSession({ token, user })
    return validSession(migrated, now) ? migrated : null
  } catch {
    clearStoredSession()
    return null
  }
}

export function updateStoredUser (user) {
  const current = readStoredSession()
  if (!current || !user) return null
  return writeStoredSession({ ...current, user })
}

export function storedAccessToken () {
  return readStoredSession()?.token || ''
}
