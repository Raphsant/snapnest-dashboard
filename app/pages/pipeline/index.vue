<script setup lang="ts">
import type { BreadcrumbItem, TableColumn, TableRow } from '@nuxt/ui'
import type { AdminPipelineJobListItem, PipelineJobStatus } from '~/types/admin'
import { formatDateTime, formatEnumLabel, getFetchErrorMessage, pipelineStatusColor, youtubeVideoId } from '~/utils/format'

const api = useApi()

const { data: jobs, status, error, refresh } = await useAsyncData(
  'admin-pipeline-jobs',
  () => api<AdminPipelineJobListItem[]>('/admin/pipeline/jobs')
)

// Full-page error only on the initial load; transient poll failures keep the last-good table.
const errorMessage = computed(() =>
  error.value && !jobs.value ? getFetchErrorMessage(error.value) : null
)

const isInitialLoading = computed(() => status.value === 'pending' && !jobs.value)

const TERMINAL_STATUSES: PipelineJobStatus[] = ['COMPLETED', 'FAILED']

const hasActiveJobs = computed(() =>
  (jobs.value ?? []).some(job => !TERMINAL_STATUSES.includes(job.status))
)

const isRefreshing = ref(false)

async function refreshJobs() {
  isRefreshing.value = true
  try {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

const { pause, resume } = useIntervalFn(refreshJobs, 10000, { immediate: false })

watch(hasActiveJobs, (active) => {
  if (active) {
    resume()
  } else {
    pause()
  }
}, { immediate: true })

// FILE jobs carry sourceFile; YOUTUBE jobs have sourceFile === null and use
// sourceUrl. Tolerate null on both paths — never dereference sourceFile blindly.
function sourceLabel(job: AdminPipelineJobListItem): string {
  if (job.sourceType === 'YOUTUBE') {
    return youtubeVideoId(job.sourceUrl) ?? job.sourceUrl ?? '—'
  }
  return job.sourceFile?.fileName ?? '—'
}

const breadcrumbItems: BreadcrumbItem[] = [{
  label: 'Workflows',
  to: '/workflows'
}, {
  label: 'Zombie Hour'
}]

const columns: TableColumn<AdminPipelineJobListItem>[] = [{
  id: 'source',
  header: 'Source',
  accessorFn: row => sourceLabel(row)
}, {
  accessorKey: 'status',
  header: 'Status'
}, {
  id: 'currentStage',
  header: 'Stage',
  cell: ({ row }) => row.original.currentStage ? formatEnumLabel(row.original.currentStage) : '—'
}, {
  accessorKey: 'createdAt',
  header: 'Created',
  cell: ({ row }) => formatDateTime(row.getValue('createdAt') as string)
}]

function onSelectJob(_event: Event, row: TableRow<AdminPipelineJobListItem>) {
  navigateTo({
    path: `/pipeline/${row.original.id}`,
    query: {
      label: sourceLabel(row.original)
    }
  })
}
</script>

<template>
  <UDashboardPanel id="pipeline">
    <template #header>
      <UDashboardNavbar title="Zombie Hour">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UBadge
              v-if="hasActiveJobs"
              color="info"
              variant="subtle"
              icon="i-lucide-radio"
              label="Live"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="isRefreshing"
              aria-label="Refresh jobs"
              @click="refreshJobs"
            />
          </div>
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

      <UTable
        v-else
        :data="jobs ?? []"
        :columns="columns"
        :loading="isInitialLoading"
        :on-select="onSelectJob"
        class="flex-1"
      >
        <template #loading>
          <div class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
          </div>
        </template>

        <template #source-cell="{ row }">
          <div class="flex items-center gap-2">
            <UBadge
              class="shrink-0"
              color="neutral"
              variant="subtle"
              size="sm"
              :icon="row.original.sourceType === 'YOUTUBE' ? 'i-lucide-youtube' : 'i-lucide-file'"
              :label="row.original.sourceType === 'YOUTUBE' ? 'YouTube' : 'File'"
            />
            <span
              class="min-w-0 truncate text-sm text-default"
              :title="sourceLabel(row.original)"
            >
              {{ sourceLabel(row.original) }}
            </span>
          </div>
        </template>

        <template #status-cell="{ row }">
          <UBadge
            :color="pipelineStatusColor(row.original.status)"
            variant="subtle"
            :label="formatEnumLabel(row.original.status)"
          />
        </template>

        <template #empty>
          <div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <UIcon name="i-lucide-workflow" class="size-10 text-dimmed" />
            <p class="text-sm font-medium text-highlighted">
              No pipeline jobs yet
            </p>
            <p class="text-sm text-muted">
              Jobs triggered against the admin API will appear here.
            </p>
          </div>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
