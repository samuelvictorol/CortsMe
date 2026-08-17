import { defineStore } from 'pinia'
import { api } from 'boot/axios'
import {
  clearStoredSession,
  readStoredSession,
  updateStoredUser,
  writeStoredSession
} from 'src/services/session-storage'

export const useAuthStore = defineStore('auth', {
  state: () => {
    const session = readStoredSession()
    return {
      token: session?.token || '',
      user: session?.user || null,
      expiresAt: session?.expiresAt || 0
    }
  },
  getters: {
    isLogged: (state) => Boolean(state.token && state.user && state.expiresAt > Date.now()),
    home: (state) => ({ ADMIN: '/adm', BARBER: '/barber', USER: '/user' }[state.user?.role] || '/')
  },
  actions: {
    setSession ({ token, user, expiresAt }) {
      const session = writeStoredSession({ token, user, expiresAt })
      this.token = session?.token || ''
      this.user = session?.user || null
      this.expiresAt = session?.expiresAt || 0
    },
    updateUser (user) {
      this.user = user
      const session = updateStoredUser(user)
      this.expiresAt = session?.expiresAt || this.expiresAt
    },
    async login (payload) {
      const { data } = await api.post('/auth/login', payload)
      this.setSession(data)
      return data
    },
    async register (payload) {
      const { data } = await api.post('/auth/register', payload)
      this.setSession(data)
      return data
    },
    async registerProfessional (payload) {
      const { data } = await api.post('/auth/register-professional', payload)
      this.setSession(data)
      return data
    },
    async refresh () {
      if (!this.isLogged) {
        if (this.token || this.user) this.logout()
        return
      }
      try {
        const { data } = await api.get('/auth/me')
        this.updateUser(data.user)
      } catch { this.logout() }
    },
    logout () {
      this.token = ''
      this.user = null
      this.expiresAt = 0
      clearStoredSession()
    }
  }
})
