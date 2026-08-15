import { defineStore } from 'pinia'
import { api } from 'boot/axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('cortsme_token') || '',
    user: JSON.parse(localStorage.getItem('cortsme_user') || 'null')
  }),
  getters: {
    isLogged: (state) => Boolean(state.token && state.user),
    home: (state) => ({ ADMIN: '/adm', BARBER: '/barber', USER: '/user' }[state.user?.role] || '/')
  },
  actions: {
    setSession ({ token, user }) {
      this.token = token
      this.user = user
      localStorage.setItem('cortsme_token', token)
      localStorage.setItem('cortsme_user', JSON.stringify(user))
    },
    updateUser (user) {
      this.user = user
      localStorage.setItem('cortsme_user', JSON.stringify(user))
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
      if (!this.token) return
      try {
        const { data } = await api.get('/auth/me')
        this.user = data.user
        localStorage.setItem('cortsme_user', JSON.stringify(data.user))
      } catch { this.logout() }
    },
    logout () {
      this.token = ''
      this.user = null
      localStorage.removeItem('cortsme_token')
      localStorage.removeItem('cortsme_user')
    }
  }
})
