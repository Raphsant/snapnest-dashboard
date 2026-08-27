<script setup lang="ts">
import type { AdminPipelineJobOutput, PipelineJobStatus } from '~/types/admin'
import { formatBytes, getFetchErrorMessage } from '~/utils/format'

const props = defineProps<{
  jobId: string
  jobStatus: PipelineJobStatus
}>()

const api = useApi()
const toast = useToast()

const outputs = ref<AdminPipelineJobOutput[]>([])
const isLoading = ref(false)
const isRefreshing = ref(false)
const loadError = ref<string | null>(null)
const downloadingIds = reactive(new Set<string>())

// Presigned URLs live 15 minutes. We auto-refetch once when a <video> reports an
// expired link, then stop (a manual refresh re-arms this one-shot).
const didAutoRefresh = ref(false)

// Render whenever S3 actually returned clips (ground truth), or the job is
// COMPLETED (where outputs are expected — show loading/empty/error there too).
// A non-COMPLETED job with an empty array renders nothing at all.
const shouldRender = computed(() =>
  outputs.value.length > 0 || props.jobStatus === 'COMPLETED'
)

async function loadOutputs() {
  const firstLoad = outputs.value.length === 0
  if (firstLoad) {
    isLoading.value = true
  } else {
    isRefreshing.value = true
  }
  loadError.value = null

  try {
    outputs.value = await api<AdminPipelineJobOutput[]>(
      `/admin/pipeline/jobs/${props.jobId}/outputs`
    )
  } catch (err: unknown) {
    loadError.value = getFetchErrorMessage(err)
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

async function refreshLinks() {
  // A deliberate refresh re-arms the one-shot auto-refetch for the next expiry.
  didAutoRefresh.value = false
  await loadOutputs()
}

async function downloadOutput(output: AdminPipelineJobOutput) {
  if (downloadingIds.has(output.clipId)) return
  downloadingIds.add(output.clipId)
  try {
    const { url } = await api<{ url: string, fileName: string }>(
      `/admin/pipeline/jobs/${props.jobId}/outputs/${output.clipId}/download-url`
    )
    window.location.href = url
  } catch (err) {
    toast.add({
      title: 'Download failed',
      description: getFetchErrorMessage(err),
      color: 'error'
    })
  } finally {
    downloadingIds.delete(output.clipId)
  }
}

async function onVideoError() {
  if (didAutoRefresh.value || isLoading.value || isRefreshing.value) {
    return
  }
  didAutoRefresh.value = true
  await loadOutputs()
}

// Attempt once on open regardless of status (a late-stage job may already have
// clips in S3), then again when the job transitions into COMPLETED under polling.
onMounted(loadOutputs)

watch(() => props.jobStatus, (status, previous) => {
  if (status === 'COMPLETED' && previous !== 'COMPLETED') {
    loadOutputs()
  }
})
</script>

<template>
  <section v-if="shouldRender">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold text-highlighted">
        Outputs<span v-if="outputs.length"> ({{ outputs.length }})</span>
      </h2>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-refresh-cw"
        label="Refresh links"
        :loading="isRefreshing"
        @click="refreshLinks"
      />
    </div>

    <div
      v-if="isLoading && !outputs.length"
      class="flex items-center justify-center py-12"
    >
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
    </div>

    <UAlert
      v-else-if="loadError && !outputs.length"
      color="error"
      variant="subtle"
      icon="i-lucide-alert-triangle"
      :title="loadError"
    />

    <div
      v-else-if="outputs.length"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <div
        v-for="output in outputs"
        :key="output.clipId"
        class="flex flex-col overflow-hidden rounded-lg border border-default bg-elevated/25"
      >
        <div class="relative aspect-[9/16] bg-black">
          <video
            :key="output.presignedUrl"
            :src="output.presignedUrl"
            controls
            preload="metadata"
            class="size-full object-contain"
            @error="onVideoError"
          />
        </div>

        <div class="space-y-1 p-3">
          <p class="truncate text-sm font-medium text-highlighted" :title="output.clipId">
            {{ output.clipId }}
          </p>
          <div class="flex items-center justify-between gap-2 text-xs text-dimmed">
            <span>{{ formatBytes(output.sizeBytes) }}</span>
            <UBadge
              v-if="output.deliveries.length"
              color="success"
              variant="subtle"
              size="sm"
              icon="i-lucide-circle-check"
              :label="`Delivered · ${output.deliveries.length}`"
            />
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            block
            icon="i-lucide-download"
            label="Download"
            :loading="downloadingIds.has(output.clipId)"
            @click="downloadOutput(output)"
          />
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-muted">
      No output clips available yet.
    </p>
  </section>
</template>
