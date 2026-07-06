type ApiOptions = Omit<NonNullable<Parameters<typeof $fetch>[1]>, 'baseURL' | 'headers'> & {
  headers?: Record<string, string>
}

export function useApi() {
  const config = useRuntimeConfig()
  const { getIdToken, signOut } = useAuth()
  const router = useRouter()

  async function handleUnauthorized(status: number): Promise<never> {
    const message = status === 403
      ? 'You are not authorized to access the admin panel.'
      : 'Your session has expired. Please sign in again.'

    await signOut()
    await router.push({
      path: '/login',
      query: { error: message }
    })

    throw new Error(message)
  }

  return async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const token = await getIdToken()

    if (!token) {
      await handleUnauthorized(401)
    }

    try {
      return await $fetch<T>(path, {
        ...options,
        baseURL: config.public.apiUrl,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`
        }
      })
    } catch (error: unknown) {
      if (
        error
        && typeof error === 'object'
        && 'status' in error
        && (error.status === 401 || error.status === 403)
      ) {
        await handleUnauthorized(error.status)
      }

      throw error
    }
  }
}
