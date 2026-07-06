import { createSharedComposable } from '@vueuse/core'
import {
  fetchAuthSession,
  fetchUserAttributes,
  getCurrentUser as amplifyGetCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut
} from 'aws-amplify/auth'

export type AuthUser = {
  userId: string
  username: string
  email: string
}

function getErrorName(error: unknown): string {
  if (
    error
    && typeof error === 'object'
    && 'name' in error
    && typeof (error as { name: unknown }).name === 'string'
  ) {
    return (error as { name: string }).name
  }
  return ''
}

function translateAmplifyError(error: unknown): string {
  const name = getErrorName(error)
  const fallback = error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'

  switch (name) {
    case 'NotAuthorizedException':
      return 'Incorrect email or password.'
    case 'UserNotConfirmedException':
      return 'This account is not verified yet.'
    case 'UserNotFoundException':
      return 'No account found with this email.'
    case 'TooManyRequestsException':
    case 'LimitExceededException':
      return 'Too many attempts. Please wait and try again.'
    default:
      return fallback
  }
}

async function loadAuthUser(): Promise<AuthUser | null> {
  try {
    const currentUser = await amplifyGetCurrentUser()
    const attrs = await fetchUserAttributes()

    return {
      userId: currentUser.userId,
      username: currentUser.username,
      email: attrs.email ?? currentUser.username
    }
  } catch {
    return null
  }
}

const _useAuth = () => {
  const user = ref<AuthUser | null>(null)
  const isInitialized = ref(false)
  let initPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)

  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      return
    }

    if (initPromise) {
      await initPromise
      return
    }

    initPromise = (async () => {
      user.value = await loadAuthUser()
      isInitialized.value = true
    })()

    await initPromise
  }

  async function signIn(email: string, password: string): Promise<void> {
    try {
      await amplifySignIn({
        username: email.trim(),
        password
      })

      user.value = await loadAuthUser()
    } catch (error: unknown) {
      throw new Error(translateAmplifyError(error), { cause: error })
    }
  }

  async function signOut(): Promise<void> {
    try {
      await amplifySignOut({ global: false })
    } finally {
      user.value = null
      clearNuxtData()
    }
  }

  async function getIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession()
      return session.tokens?.idToken?.toString() ?? null
    } catch {
      return null
    }
  }

  return {
    user: readonly(user),
    isAuthenticated,
    isInitialized: readonly(isInitialized),
    initialize,
    signIn,
    signOut,
    getIdToken
  }
}

export const useAuth = createSharedComposable(_useAuth)
