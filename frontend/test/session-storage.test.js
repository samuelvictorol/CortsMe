import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SESSION_TTL_MS,
  clearStoredSession,
  readStoredSession,
  updateStoredUser,
  writeStoredSession
} from '../src/services/session-storage.js'

function fakeStorage () {
  const values = new Map()
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values
  }
}

function tokenWithExpiry (expiresAt) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(expiresAt / 1000) })}.signature`
}

test.beforeEach(() => {
  global.window = { localStorage: fakeStorage(), atob: value => Buffer.from(value, 'base64').toString('binary') }
})

test.afterEach(() => {
  clearStoredSession()
  delete global.window
})

test('persiste usuário e token com retenção máxima de 120 dias', () => {
  const now = Date.now()
  const token = tokenWithExpiry(now + SESSION_TTL_MS + 86400000)
  const session = writeStoredSession({ token, user: { id: 'user-1', role: 'USER' } })

  assert.equal(session.user.id, 'user-1')
  assert.ok(session.expiresAt <= now + SESSION_TTL_MS + 1000)
  assert.equal(readStoredSession()?.token, token)
})

test('nunca mantém dados além da validade real do JWT', () => {
  const now = Date.now()
  const tokenExpiry = now + 60000
  const session = writeStoredSession({ token: tokenWithExpiry(tokenExpiry), user: { id: 'user-2' } })

  assert.ok(session.expiresAt <= tokenExpiry)
  assert.equal(readStoredSession(tokenExpiry + 1000), null)
  assert.equal(window.localStorage.getItem('cortsme_session'), null)
})

test('atualiza o usuário sem renovar silenciosamente a expiração da sessão', () => {
  const expiry = Date.now() + 3600000
  writeStoredSession({ token: tokenWithExpiry(expiry), user: { id: 'user-3', name: 'Antes' }, expiresAt: expiry })
  const updated = updateStoredUser({ id: 'user-3', name: 'Depois' })

  assert.equal(updated.user.name, 'Depois')
  assert.equal(updated.expiresAt, Math.floor(expiry / 1000) * 1000)
})

test('migra chaves legadas e remove duplicatas antigas', () => {
  const token = tokenWithExpiry(Date.now() + 3600000)
  window.localStorage.setItem('cortsme_token', token)
  window.localStorage.setItem('cortsme_user', JSON.stringify({ id: 'legacy' }))

  assert.equal(readStoredSession()?.user.id, 'legacy')
  assert.equal(window.localStorage.getItem('cortsme_token'), null)
  assert.equal(window.localStorage.getItem('cortsme_user'), null)
})
