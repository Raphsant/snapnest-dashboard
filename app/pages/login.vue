<script setup lang="ts">
definePageMeta({
  layout: false
})

const route = useRoute()
const { signIn } = useAuth()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

const routeError = computed(() => {
  const value = route.query.error
  return typeof value === 'string' ? value : null
})

async function onSubmit() {
  error.value = null
  loading.value = true

  try {
    await signIn(email.value, password.value)
    await navigateTo('/')
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Sign in failed.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-default px-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="text-center">
          <p class="text-lg font-semibold text-highlighted">
            SnapNest Admin
          </p>
          <p class="mt-1 text-sm text-muted">
            Sign in to continue
          </p>
        </div>
      </template>

      <UAlert
        v-if="routeError"
        color="error"
        variant="subtle"
        :title="routeError"
        class="mb-4"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        :title="error"
        class="mb-4"
      />

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
          />
        </UFormField>

        <UFormField label="Password">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
          />
        </UFormField>

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          Sign in
        </UButton>
      </form>
    </UCard>
  </div>
</template>
