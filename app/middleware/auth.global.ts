export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, initialize } = useAuth()

  await initialize()

  if (to.path === '/login') {
    if (isAuthenticated.value) {
      return navigateTo('/')
    }
    return
  }

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
