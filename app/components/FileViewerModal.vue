<script setup lang="ts">
import type { AdminMediaFile } from '~/types/admin'

defineProps<{
  file: AdminMediaFile | null
  fullUrl: string | null
}>()

const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <UModal
    v-model:open="open"
    :title="file?.fileName"
    :ui="{ content: 'max-w-4xl' }"
  >
    <template #body>
      <div v-if="file" class="flex items-center justify-center">
        <img
          v-if="file.fileType === 'PHOTO' && fullUrl"
          :src="fullUrl"
          :alt="file.fileName"
          class="max-h-[70vh] w-full object-contain"
        >
        <video
          v-else-if="file.fileType === 'VIDEO' && fullUrl"
          :src="fullUrl"
          controls
          class="max-h-[70vh] w-full"
        />
        <div v-else class="flex flex-col items-center gap-2 py-12 text-muted">
          <UIcon :name="file.fileType === 'VIDEO' ? 'i-lucide-video' : 'i-lucide-image'" class="size-10" />
          <p class="text-sm">
            Preview unavailable for this file.
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
