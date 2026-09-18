<script setup lang="ts">
import type { BreadcrumbItem, TableColumn } from '@nuxt/ui'
import type {
  AdminPipelineJob,
  PipelineClip,
  PipelineJobStatus,
  PipelineRejectedSegment
} from '~/types/admin'
import {
  clipConfidenceColor,
  formatDateTime,
  formatDuration,
  formatEnumLabel,
  getErrorStatus,
  getFetchErrorMessage,
  pipelineStatusColor,
  youtubeVideoId
} from '~/utils/format'

const route = useRoute()
const jobId = route.params.id as string
const labelHint = typeof route.query.label === 'string' ? route.query.label : null
const api = useApi()
const toast = useToast()

const { data: job, status, error, refresh } = await useAsyncData(
  `admin-pipeline-job-${jobId}`,
  () => api<AdminPipelineJob>(`/admin/pipeline/jobs/${jobId}`)
)

const errorMessage = computed(() =>
  error.value && !job.value ? getFetchErrorMessage(error.value) : null
)

// YOUTUBE jobs have no sourceFile, so derive the title from the URL once the job
// loads; the label query param is only a pre-fetch placeholder (fileName for
// FILE jobs, video id for YOUTUBE).
const title = computed(() => {
  if (job.value?.sourceType === 'YOUTUBE') {
    return youtubeVideoId(job.value.sourceUrl) ?? job.value.sourceUrl ?? 'YouTube run'
  }
  return labelHint ?? 'Pipeline job'
})

const breadcrumbItems = computed((): BreadcrumbItem[] => [{
  label: 'Workflows',
  to: '/workflows'
}, {
  label: 'Zombie Hour',
  to: '/pipeline'
}, {
  label: title.value
}])

const manifest = computed(() => job.value?.manifest ?? null)
const clips = computed(() => manifest.value?.clips ?? [])
const rejectedSegments = computed(() => manifest.value?.rejected_segments ?? [])

const isRefreshing = ref(false)
const approvalDecisions = ref<Record<string, boolean>>({})
const decisionsTouched = ref(false)
const confirmationOpen = ref(false)
const isSubmitting = ref(false)
const creativeConfirmationOpen = ref(false)
const isSubmittingCreative = ref(false)
const reopenConfirmationOpen = ref(false)
const isReopening = ref(false)

const TERMINAL_STATUSES: PipelineJobStatus[] = ['COMPLETED', 'FAILED']

const isApprovalMode = computed(() =>
  job.value?.status === 'AWAITING_MANIFEST_APPROVAL'
)

const isCreativeApprovalMode = computed(() =>
  job.value?.status === 'AWAITING_CREATIVE_APPROVAL'
)

const hasUnsavedDecisions = computed(() =>
  isApprovalMode.value && decisionsTouched.value
)

const shouldPoll = computed(() =>
  Boolean(job.value)
  && !TERMINAL_STATUSES.includes(job.value!.status)
  && !hasUnsavedDecisions.value
)

/** Delivered clips are locked to approved, so only the rest are decidable. */
const decidableClips = computed(() =>
  clips.value.filter(clip => !isDelivered(clip))
)

const approvedCount = computed(() =>
  decidableClips.value.filter(clip => approvalDecisions.value[clip.id]).length
)

const rejectedCount = computed(() =>
  decidableClips.value.length - approvedCount.value
)

const approvedClipTitles = computed(() =>
  decidableClips.value
    .filter(clip => approvalDecisions.value[clip.id])
    .map(clip => clip.title || clip.id)
)

async function refreshJob() {
  isRefreshing.value = true
  try {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

const { pause, resume } = useIntervalFn(refreshJob, 10000, { immediate: false })

watch(shouldPoll, (active) => {
  if (active) {
    resume()
  } else {
    pause()
  }
}, { immediate: true })

watch(
  () => [job.value?.status, clips.value.map(clip => clip.id).join(',')] as const,
  ([jobStatus]) => {
    if (jobStatus === 'AWAITING_MANIFEST_APPROVAL') {
      // Seed from the clip's own verdict, not `false`: a reopened job carries
      // already-approved clips, and seeding those false would silently
      // de-approve them on submit. Delivered clips are locked to approved
      // regardless of their verdict. First-pass clips have `approved === null`,
      // so they still start out rejected.
      if (!decisionsTouched.value) {
        approvalDecisions.value = Object.fromEntries(
          clips.value.map(clip => [clip.id, isDelivered(clip) || clip.approved === true])
        )
      }
      return
    }

    approvalDecisions.value = {}
    decisionsTouched.value = false
    confirmationOpen.value = false
  },
  { immediate: true }
)

watch(isCreativeApprovalMode, (active) => {
  if (!active) {
    creativeConfirmationOpen.value = false
  }
})

watch(() => job.value?.status, (jobStatus) => {
  if (jobStatus !== 'COMPLETED') {
    reopenConfirmationOpen.value = false
  }
})

onBeforeRouteLeave(() => {
  if (!hasUnsavedDecisions.value) {
    return true
  }

  return window.confirm('Unsaved approval decisions')
})

useEventListener(window, 'beforeunload', (event) => {
  if (!hasUnsavedDecisions.value) {
    return
  }

  event.preventDefault()
  event.returnValue = ''
})

onBeforeUnmount(pause)

function setClipDecision(clipId: string, approved: boolean) {
  approvalDecisions.value = {
    ...approvalDecisions.value,
    [clipId]: approved
  }
  decisionsTouched.value = true
}

function setAllDecisions(approved: boolean) {
  approvalDecisions.value = Object.fromEntries(
    clips.value.map(clip => [clip.id, isDelivered(clip) || approved])
  )
  decisionsTouched.value = true
}

function clipCardClass(clipId: string): string | undefined {
  if (!isApprovalMode.value) {
    return undefined
  }

  return approvalDecisions.value[clipId]
    ? 'ring-2 ring-success'
    : 'opacity-75'
}

function showCreativeFields(clip: PipelineClip): boolean {
  const hasCreativeContent = clip.hook_asset_id != null
    || clip.hook_prompt != null
    || Boolean(clip.post_copy?.trim())
    || clip.captions != null

  if (hasCreativeContent) {
    return true
  }

  return clip.approved === true
    && (isCreativeApprovalMode.value || job.value?.status === 'CREATIVE_APPROVED')
}

/** Old jobs have prompts but no asset ids — render the legacy prompt panels. */
function showLegacyPrompts(clip: PipelineClip): boolean {
  return clip.hook_prompt != null && clip.hook_asset_id == null
}

/** An assembly checkpoint means this clip's video already shipped. */
function isDelivered(clip: PipelineClip): boolean {
  return clip.assembled != null
}

async function submitDecisions() {
  isSubmitting.value = true

  try {
    const updatedJob = await api<AdminPipelineJob>(
      `/admin/pipeline/jobs/${jobId}/approve`,
      {
        method: 'POST',
        body: {
          approvals: clips.value.map(clip => ({
            clipId: clip.id,
            // Backend requires every clip; delivered ones always go as approved.
            approved: isDelivered(clip)
              || Boolean(approvalDecisions.value[clip.id])
          }))
        }
      }
    )

    confirmationOpen.value = false
    decisionsTouched.value = false
    job.value = updatedJob

    toast.add({
      title: 'Approval decisions submitted',
      color: 'success'
    })
  } catch (submitError: unknown) {
    const errorStatus = getErrorStatus(submitError)
    confirmationOpen.value = false

    if (errorStatus === 409) {
      toast.add({
        title: 'Job is no longer awaiting approval',
        color: 'error'
      })
      await refresh()
      return
    }

    toast.add({
      title: getFetchErrorMessage(submitError),
      color: 'error'
    })
  } finally {
    isSubmitting.value = false
  }
}

async function approveCreative() {
  isSubmittingCreative.value = true

  try {
    const updatedJob = await api<AdminPipelineJob>(
      `/admin/pipeline/jobs/${jobId}/approve-creative`,
      { method: 'POST' }
    )

    creativeConfirmationOpen.value = false
    job.value = updatedJob

    toast.add({
      title: 'Creative approved',
      color: 'success'
    })
  } catch (submitError: unknown) {
    const errorStatus = getErrorStatus(submitError)
    creativeConfirmationOpen.value = false

    if (errorStatus === 409) {
      toast.add({
        title: 'Job is no longer awaiting creative approval',
        color: 'error'
      })
      await refresh()
      return
    }

    toast.add({
      title: getFetchErrorMessage(submitError),
      color: 'error'
    })
  } finally {
    isSubmittingCreative.value = false
  }
}

async function reopenJob() {
  isReopening.value = true

  try {
    // Unlike approve / approve-creative, the reopen response is not consumed —
    // refresh() re-seeds the decisions and restarts polling from the new state.
    await api<unknown>(`/admin/pipeline/jobs/${jobId}/reopen`, { method: 'POST' })

    reopenConfirmationOpen.value = false
    await refresh()

    toast.add({
      title: 'Job reopened',
      color: 'success'
    })
  } catch (reopenError: unknown) {
    const errorStatus = getErrorStatus(reopenError)
    reopenConfirmationOpen.value = false

    if (errorStatus === 409) {
      toast.add({
        title: 'Job is no longer completed',
        color: 'error'
      })
      await refresh()
      return
    }

    toast.add({
      title: getFetchErrorMessage(reopenError),
      color: 'error'
    })
  } finally {
    isReopening.value = false
  }
}

function formatBlockRange(start?: number, end?: number): string {
  if (start === undefined && end === undefined) {
    return '—'
  }
  if (end === undefined || start === end) {
    return `${start ?? end}`
  }
  return `${start ?? '—'}–${end}`
}

const rejectedColumns: TableColumn<PipelineRejectedSegment>[] = [{
  id: 'category',
  header: 'Category',
  accessorFn: row => row.category ? formatEnumLabel(row.category) : '—'
}, {
  id: 'blocks',
  header: 'Blocks',
  accessorFn: row => formatBlockRange(row.start_block, row.end_block)
}, {
  id: 'topic',
  header: 'Topic',
  accessorFn: row => row.topic ?? '—'
}, {
  id: 'reason',
  header: 'Reason',
  accessorFn: row => row.reason ?? '—'
}]
</script>

<template>
  <UDashboardPanel :id="`pipeline-job-${jobId}`">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="isRefreshing"
            aria-label="Refresh job"
            @click="refreshJob"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UBreadcrumb :items="breadcrumbItems" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <ApiErrorState
        v-if="errorMessage"
        :message="errorMessage"
        @retry="refresh()"
      />

      <div
        v-else-if="status === 'pending' && !job"
        class="flex items-center justify-center py-24"
      >
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div v-else-if="job" class="space-y-6">
        <section class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <UBadge
            :color="pipelineStatusColor(job.status)"
            variant="subtle"
            size="lg"
            :label="formatEnumLabel(job.status)"
          />
          <span v-if="job.currentStage" class="text-sm text-muted">
            Stage: {{ formatEnumLabel(job.currentStage) }}
          </span>
          <span class="text-sm text-dimmed">
            Created {{ formatDateTime(job.createdAt) }}
          </span>

          <UButton
            v-if="job.status === 'COMPLETED'"
            type="button"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-rotate-ccw"
            label="Reopen for more clips"
            class="ml-auto"
            :disabled="isReopening"
            :loading="isReopening"
            @click="reopenConfirmationOpen = true"
          />
        </section>

        <UAlert
          v-if="job.status === 'FAILED' && job.error"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-triangle"
          title="Pipeline failed"
          :description="job.error"
        />

        <JobOutputs :job-id="jobId" :job-status="job.status" :clips="clips" />

        <template v-if="manifest">
          <section>
            <h2 class="mb-3 text-sm font-semibold text-highlighted">
              Clips ({{ clips.length }})
            </h2>

            <div v-if="clips.length" class="grid gap-4">
              <UCard
                v-for="clip in clips"
                :key="clip.id"
                :ui="{ body: 'space-y-3' }"
                :class="clipCardClass(clip.id)"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="space-y-1">
                    <h3 class="font-semibold text-highlighted">
                      {{ clip.title || clip.id }}
                    </h3>
                    <div class="flex items-center gap-2 text-xs text-muted">
                      <span>{{ clip.start }} – {{ clip.end }}</span>
                      <span>·</span>
                      <span>{{ formatDuration(clip.duration_seconds) }}</span>
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge
                      color="neutral"
                      variant="subtle"
                      :label="formatEnumLabel(clip.category)"
                    />
                    <UBadge
                      :color="clipConfidenceColor(clip.confidence)"
                      variant="outline"
                      :label="formatEnumLabel(clip.confidence)"
                    />
                    <UTooltip
                      v-if="isApprovalMode && isDelivered(clip)"
                      text="Already delivered — locked as approved."
                    >
                      <UBadge
                        color="success"
                        variant="subtle"
                        size="sm"
                        icon="i-lucide-circle-check"
                        label="Delivered"
                      />
                    </UTooltip>
                    <UButtonGroup v-if="isApprovalMode && !isDelivered(clip)" size="xs">
                      <UButton
                        type="button"
                        color="error"
                        :variant="approvalDecisions[clip.id] ? 'outline' : 'solid'"
                        icon="i-lucide-x"
                        label="Reject"
                        @click="setClipDecision(clip.id, false)"
                      />
                      <UButton
                        type="button"
                        color="success"
                        :variant="approvalDecisions[clip.id] ? 'solid' : 'outline'"
                        icon="i-lucide-check"
                        label="Approve"
                        @click="setClipDecision(clip.id, true)"
                      />
                    </UButtonGroup>
                  </div>
                </div>

                <p v-if="clip.summary" class="text-sm text-default">
                  {{ clip.summary }}
                </p>

                <p v-if="clip.rationale" class="text-sm text-muted">
                  <span class="font-medium text-highlighted">Rationale: </span>{{ clip.rationale }}
                </p>

                <section
                  v-if="showCreativeFields(clip)"
                  class="space-y-3 rounded-md border border-default bg-elevated/25 p-3"
                >
                  <h4 class="text-sm font-semibold text-highlighted">
                    Creative
                  </h4>

                  <dl class="space-y-3">
                    <template v-if="showLegacyPrompts(clip)">
                      <div>
                        <dt class="text-xs font-medium text-muted">
                          Hook prompt
                        </dt>
                        <dd class="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-xs text-default">
                          {{ clip.hook_prompt || '—' }}
                        </dd>
                      </div>

                      <div>
                        <dt class="text-xs font-medium text-muted">
                          Close prompt
                        </dt>
                        <dd class="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-xs text-default">
                          {{ clip.close_prompt || '—' }}
                        </dd>
                      </div>
                    </template>

                    <template v-else>
                      <div>
                        <dt class="text-xs font-medium text-muted">
                          Hook
                        </dt>
                        <dd class="mt-1 flex items-start gap-2 rounded-md bg-muted/50 p-2">
                          <UBadge
                            v-if="clip.hook_asset_id"
                            color="neutral"
                            variant="outline"
                            :label="clip.hook_asset_id"
                          />
                          <p class="whitespace-pre-wrap font-mono text-xs text-default">
                            {{ clip.hook_text || '—' }}
                          </p>
                        </dd>
                      </div>

                      <div>
                        <dt class="text-xs font-medium text-muted">
                          Outro
                        </dt>
                        <dd class="mt-1 flex items-start gap-2 rounded-md bg-muted/50 p-2">
                          <UBadge
                            v-if="clip.outro_asset_id"
                            color="neutral"
                            variant="outline"
                            :label="clip.outro_asset_id"
                          />
                          <p class="whitespace-pre-wrap font-mono text-xs text-default">
                            {{ clip.close_text || '—' }}
                          </p>
                        </dd>
                      </div>
                    </template>

                    <div>
                      <dt class="text-xs font-medium text-muted">
                        Post copy
                      </dt>
                      <dd class="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-xs text-default">
                        {{ clip.post_copy || '—' }}
                      </dd>
                    </div>
                  </dl>
                </section>

                <details class="group rounded-md border border-default bg-elevated/25 p-3">
                  <summary class="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-highlighted">
                    <UIcon
                      name="i-lucide-chevron-right"
                      class="size-4 transition-transform group-open:rotate-90"
                    />
                    Transcript
                  </summary>
                  <p class="mt-3 whitespace-pre-wrap text-sm text-muted">
                    {{ clip.transcript }}
                  </p>
                </details>
              </UCard>
            </div>

            <p v-else class="text-sm text-muted">
              This manifest contains no clips.
            </p>
          </section>

          <section v-if="rejectedSegments.length">
            <h2 class="mb-3 text-sm font-semibold text-highlighted">
              Rejected segments ({{ rejectedSegments.length }})
            </h2>
            <UTable :data="rejectedSegments" :columns="rejectedColumns" />
          </section>
        </template>

        <section
          v-else
          class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-default py-16 text-center"
        >
          <UIcon name="i-lucide-hourglass" class="size-10 text-dimmed" />
          <p class="text-sm font-medium text-highlighted">
            No manifest yet
          </p>
          <p class="text-sm text-muted">
            The manifest appears once the job reaches manifest approval.
          </p>
        </section>

        <section
          v-if="isApprovalMode"
          class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-default bg-default/95 p-4 shadow-lg backdrop-blur"
        >
          <p class="text-sm font-medium text-highlighted">
            {{ approvedCount }} approved · {{ rejectedCount }} rejected
          </p>

          <div class="flex flex-wrap items-start justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              @click="setAllDecisions(true)"
            >
              Approve all
            </UButton>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              @click="setAllDecisions(false)"
            >
              Reject all
            </UButton>
            <div class="flex flex-col items-end gap-1">
              <UButton
                type="button"
                :disabled="isSubmitting || approvedCount === 0"
                :loading="isSubmitting"
                @click="confirmationOpen = true"
              >
                Submit decisions
              </UButton>
              <span v-if="approvedCount === 0" class="text-xs text-muted">
                Approve at least one clip
              </span>
            </div>
          </div>
        </section>

        <section
          v-if="isCreativeApprovalMode"
          class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-default bg-default/95 p-4 shadow-lg backdrop-blur"
        >
          <p class="text-sm text-muted">
            Review the creative prompts and captions before continuing.
          </p>

          <UButton
            type="button"
            :disabled="isSubmittingCreative"
            :loading="isSubmittingCreative"
            @click="creativeConfirmationOpen = true"
          >
            Approve creative &amp; continue
          </UButton>
        </section>
      </div>

      <UModal v-model:open="confirmationOpen" title="Submit approval decisions">
        <template #body>
          <div class="space-y-4">
            <p class="text-sm text-default">
              {{ approvedCount }} approved · {{ rejectedCount }} rejected
            </p>

            <div>
              <h3 class="mb-2 text-sm font-medium text-highlighted">
                Approved clips
              </h3>
              <ul class="max-h-64 space-y-1 overflow-y-auto rounded-md border border-default p-3">
                <li
                  v-for="clipTitle in approvedClipTitles"
                  :key="clipTitle"
                  class="text-sm text-muted"
                >
                  {{ clipTitle }}
                </li>
              </ul>
            </div>

            <div class="flex justify-end gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                :disabled="isSubmitting"
                @click="confirmationOpen = false"
              >
                Cancel
              </UButton>
              <UButton
                type="button"
                :loading="isSubmitting"
                :disabled="isSubmitting"
                @click="submitDecisions"
              >
                Confirm
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="creativeConfirmationOpen" title="Approve creative">
        <template #body>
          <div class="space-y-4">
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-circle-alert"
              title="This will proceed to AI video generation"
              description="Continuing may spend credits."
            />

            <div class="flex justify-end gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                :disabled="isSubmittingCreative"
                @click="creativeConfirmationOpen = false"
              >
                Cancel
              </UButton>
              <UButton
                type="button"
                :loading="isSubmittingCreative"
                :disabled="isSubmittingCreative"
                @click="approveCreative"
              >
                Approve &amp; continue
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="reopenConfirmationOpen" title="Reopen for more clips">
        <template #body>
          <div class="space-y-4">
            <UAlert
              color="warning"
              variant="subtle"
              icon="i-lucide-circle-alert"
              title="This returns the job to manifest approval"
              description="Already-approved clips stay approved, and their delivered videos are left in place."
            />

            <div class="flex justify-end gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                :disabled="isReopening"
                @click="reopenConfirmationOpen = false"
              >
                Cancel
              </UButton>
              <UButton
                type="button"
                :loading="isReopening"
                :disabled="isReopening"
                @click="reopenJob"
              >
                Reopen
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
