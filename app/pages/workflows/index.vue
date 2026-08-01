<script setup lang="ts">
import type {
  AdminPipelineJob,
  AdminPipelineJobListItem,
  CreateYoutubeJobRequest,
  PipelineJobStatus,
  WorkflowDefinition
} from '~/types/admin'
import {
  getErrorStatus,
  getFetchErrorMessage,
  isLikelyYoutubeUrl,
  youtubeVideoId
} from '~/utils/format'

const api = useApi()

// Cards are data-driven: adding a second workflow is a new array entry, not a
// rewrite. Its active-run count rule lives in `activeCountByWorkflow` below.
const workflows: WorkflowDefinition[] = [{
  id: 'zombie-hour',
  name: 'Zombie Hour',
  description: 'Turn a long YouTube session into finished, captioned 9:16 social clips.',
  icon: 'i-lucide-clapperboard',
  runsTo: '/pipeline'
}]

const { data: jobs, status, error, refresh } = await useAsyncData(
  'workflows-active-counts',
  () => api<AdminPipelineJobListItem[]>('/admin/pipeline/jobs')
)

const TERMINAL_STATUSES: PipelineJobStatus[] = ['COMPLETED', 'FAILED']

const isCountLoading = computed(() => status.value === 'pending' && !jobs.value)
const countError = computed(() => Boolean(error.value) && !jobs.value)

const activeCountByWorkflow = computed<Record<string, number>>(() => {
  const list = jobs.value ?? []
  return {
    // Zombie Hour is the only YouTube workflow today; count its non-terminal runs.
    'zombie-hour': list.filter(
      job => job.sourceType === 'YOUTUBE' && !TERMINAL_STATUSES.includes(job.status)
    ).length
  }
})

function activeRunsLabel(workflowId: string): string {
  if (isCountLoading.value || countError.value) {
    return 'View runs'
  }
  const count = activeCountByWorkflow.value[workflowId] ?? 0
  return `${count} active ${count === 1 ? 'run' : 'runs'}`
}

const isRefreshing = ref(false)

async function refreshCounts() {
  isRefreshing.value = true
  try {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

// Start-run modal ----------------------------------------------------------
const startOpen = ref(false)
const activeWorkflow = ref<WorkflowDefinition | null>(null)
const youtubeUrl = ref('')
const startError = ref<string | null>(null)
const duplicate = ref<{ jobId: string | null } | null>(null)
const isStarting = ref(false)

function openStartRun(workflow: WorkflowDefinition) {
  activeWorkflow.value = workflow
  youtubeUrl.value = ''
  startError.value = null
  duplicate.value = null
  startOpen.value = true
}

/** The 409 body carries the existing job id; be forgiving about its key. */
function extractDuplicateJobId(err: unknown): string | null {
  if (!err || typeof err !== 'object' || !('data' in err)) {
    return null
  }
  const data = (err as { data: unknown }).data
  if (!data || typeof data !== 'object') {
    return null
  }
  const record = data as Record<string, unknown>
  for (const candidate of [record.jobId, record.existingJobId, record.activeJobId]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }
  return null
}

async function submitStartRun() {
  startError.value = null
  duplicate.value = null

  const url = youtubeUrl.value.trim()
  if (!isLikelyYoutubeUrl(url)) {
    startError.value = 'Enter a valid YouTube URL (youtube.com or youtu.be).'
    return
  }

  isStarting.value = true
  try {
    const body: CreateYoutubeJobRequest = { sourceUrl: url }
    const job = await api<AdminPipelineJob>('/admin/pipeline/jobs/youtube', {
      method: 'POST',
      body
    })

    startOpen.value = false
    await navigateTo({
      path: `/pipeline/${job.id}`,
      query: { label: youtubeVideoId(job.sourceUrl) ?? job.sourceUrl ?? job.id }
    })
  } catch (err: unknown) {
    if (getErrorStatus(err) === 409) {
      duplicate.value = { jobId: extractDuplicateJobId(err) }
      return
    }
    // Surface the backend's 400 (and anything else) verbatim.
    startError.value = getFetchErrorMessage(err)
  } finally {
    isStarting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="workflows">
    <template #header>
      <UDashboardNavbar title="Workflows">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="isRefreshing"
            aria-label="Refresh active counts"
            @click="refreshCounts"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="workflow in workflows"
          :key="workflow.id"
          :ui="{ body: 'space-y-4' }"
        >
          <div class="flex items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-elevated/50">
              <UIcon :name="workflow.icon" class="size-5 text-primary" />
            </div>
            <div class="min-w-0 space-y-1">
              <h2 class="font-semibold text-highlighted">
                {{ workflow.name }}
              </h2>
              <p class="text-sm text-muted">
                {{ workflow.description }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3">
            <UButton
              :to="workflow.runsTo"
              color="neutral"
              variant="link"
              class="px-0"
              trailing-icon="i-lucide-arrow-right"
              :loading="isCountLoading"
              :label="activeRunsLabel(workflow.id)"
            />
            <UButton
              icon="i-lucide-play"
              label="Start run"
              @click="openStartRun(workflow)"
            />
          </div>
        </UCard>
      </div>

      <UModal
        v-model:open="startOpen"
        :title="`Start ${activeWorkflow?.name ?? ''} run`"
      >
        <template #body>
          <div class="space-y-4">
            <UAlert
              v-if="startError"
              color="error"
              variant="subtle"
              :title="startError"
            />

            <UAlert
              v-if="duplicate"
              color="warning"
              variant="subtle"
              icon="i-lucide-circle-alert"
              title="A run for this video is already active"
              description="Open the existing run instead of starting a new one."
            >
              <template #actions>
                <UButton
                  color="warning"
                  variant="outline"
                  size="xs"
                  :to="duplicate.jobId ? `/pipeline/${duplicate.jobId}` : activeWorkflow?.runsTo"
                  :label="duplicate.jobId ? 'View active run' : 'View runs'"
                />
              </template>
            </UAlert>

            <form class="space-y-4" @submit.prevent="submitStartRun">
              <UFormField label="YouTube URL" required>
                <UInput
                  v-model="youtubeUrl"
                  placeholder="https://www.youtube.com/watch?v=…"
                  autofocus
                  class="w-full"
                />
              </UFormField>

              <div class="flex justify-end gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  :disabled="isStarting"
                  @click="startOpen = false"
                >
                  Cancel
                </UButton>
                <UButton
                  type="submit"
                  :loading="isStarting"
                  :disabled="isStarting"
                >
                  Start run
                </UButton>
              </div>
            </form>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
