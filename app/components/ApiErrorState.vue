<script setup lang="ts">
defineProps<{
  message: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
    <UIcon name="i-lucide-alert-circle" class="size-10 text-error" />
    <p class="max-w-md text-sm text-muted">
      {{ message }}
    </p>
    <UButton
      color="neutral"
      variant="outline"
      icon="i-lucide-refresh-cw"
      @click="emit('retry')"
    >
      Retry
    </UButton>
  </div>
</template>
