<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { AdminPipelineJobListItem, PipelineJobStatus } from '~/types/admin'
import { formatDateTime, formatEnumLabel, getFetchErrorMessage, pipelineStatusColor } from '~/utils/format'

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

const columns: TableColumn<AdminPipelineJobListItem>[] = [{
  id: 'fileName',
  header: 'File',
  accessorFn: row => row.sourceFile.fileName
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
      fileName: row.original.sourceFile.fileName
    }
  })
}
</script>

<template>
  <UDashboardPanel id="pipeline">
    <template #header>
      <UDashboardNavbar title="Pipeline">
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
