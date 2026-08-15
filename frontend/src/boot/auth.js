import { defineBoot } from '#q-app/wrappers'
import { useAuthStore } from 'stores/auth-store'

export default defineBoot((bootContext) => {
  const router = bootContext.router
  const auth = useAuthStore()
  auth.refresh()

  router.beforeEach((to) => {
    if (to.meta.public) return true
    if (!auth.isLogged) return { path: '/login', query: { redirect: to.fullPath } }
    if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) return auth.home
    return true
  })
})
