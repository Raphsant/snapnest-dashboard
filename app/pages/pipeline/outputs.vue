<script setup lang="ts">
import type { BreadcrumbItem, TableColumn } from '@nuxt/ui'
import type {
  AdminPipelineOutputListItem,
  AdminPipelineOutputListResponse
} from '~/types/admin'
import { formatDateTime, formatRelativeTime, getFetchErrorMessage } from '~/utils/format'

const api = useApi()
const toast = useToast()

type PostedFilter = 'unposted' | 'posted' | 'all'

const PAGE_SIZE = 25

const FILTERS: { value: PostedFilter, label: string }[] = [
  { value: 'unposted', label: 'To publish' },
  { value: 'posted', label: 'Posted' },
  { value: 'all', label: 'All' }
]

const filter = ref<PostedFilter>('unposted')
const page = ref(1)

const { data, status, error, refresh } = await useAsyncData(
  'admin-pipeline-outputs',
  () => api<AdminPipelineOutputListResponse>('/admin/pipeline/outputs', {
    query: {
      limit: PAGE_SIZE,
      offset: (page.value - 1) * PAGE_SIZE,
      // An absent `posted` means "all" — only send it for the narrowed views.
      ...(filter.value === 'all' ? {} : { posted: filter.value === 'posted' })
    }
  }),
  { watch: [filter, page] }
)

const items = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)

const errorMessage = computed(() =>
  error.value && !data.value ? getFetchErrorMessage(error.value) : null
)

const isInitialLoading = computed(() => status.value === 'pending' && !data.value)

const rangeLabel = computed(() => {
  if (!total.value || !items.value.length) {
    return 'No outputs'
  }
  const first = (page.value - 1) * PAGE_SIZE + 1
  return `${first}–${first + items.value.length - 1} of ${total.value}`
})

const emptyTitle = computed(() => {
  switch (filter.value) {
    case 'unposted':
      return 'Nothing left to publish'
    case 'posted':
      return 'Nothing marked posted yet'
    default:
      return 'No output clips yet'
  }
})

function setFilter(next: PostedFilter) {
  if (filter.value === next) return
  // Both refs are watched; Vue batches them into a single refetch.
  page.value = 1
  filter.value = next
}

const isRefreshing = ref(false)

async function refreshOutputs() {
  isRefreshing.value = true
  try {
    await refresh()
  } finally {
    isRefreshing.value = false
  }
}

const pendingKeys = reactive(new Set<string>())

/** clipId is only unique within a job, so key rows by the pair. */
function outputKey(item: AdminPipelineOutputListItem): string {
  return `${item.jobId}:${item.clipId}`
}

async function togglePosted(item: AdminPipelineOutputListItem) {
  const key = outputKey(item)
  if (pendingKeys.has(key)) return

  const markPosted = item.postedAt === null
  pendingKeys.add(key)

  try {
    await api<unknown>(
      `/admin/pipeline/jobs/${item.jobId}/outputs/${item.clipId}/posted`,
      { method: markPosted ? 'PUT' : 'DELETE' }
    )

    await refresh()

    // Under a narrowed filter the row leaves the list; step back if that
    // emptied the last page.
    if (!items.value.length && page.value > 1) {
      page.value -= 1
    }

    toast.add({
      title: markPosted ? 'Marked as posted' : 'Posted mark cleared',
      color: 'success'
    })
  } catch (toggleError: unknown) {
    toast.add({
      title: markPosted ? 'Could not mark as posted' : 'Could not clear posted mark',
      description: getFetchErrorMessage(toggleError),
      color: 'error'
    })
  } finally {
    pendingKeys.delete(key)
  }
}

const breadcrumbItems: BreadcrumbItem[] = [{
  label: 'Workflows',
  to: '/workflows'
}, {
  label: 'Zombie Hour',
  to: '/pipeline'
}, {
  label: 'To Publish'
}]

const columns: TableColumn<AdminPipelineOutputListItem>[] = [{
  accessorKey: 'clipId',
  header: 'Clip'
}, {
  id: 'job',
  header: 'Job'
}, {
  accessorKey: 'completedAt',
  header: 'Completed'
}, {
  id: 'posted',
  header: 'Posted'
}, {
  id: 'action',
  header: ''
}]
</script>

<template>
  <UDashboardPanel id="pipeline-outputs">
    <template #header>
      <UDashboardNavbar title="To Publish">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="isRefreshing"
            aria-label="Refresh outputs"
            @click="refreshOutputs"
          />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <UBreadcrumb :items="breadcrumbItems" />
        </template>

        <template #right>
          <UButtonGroup size="xs">
            <UButton
              v-for="option in FILTERS"
              :key="option.value"
              type="button"
              color="neutral"
              :variant="filter === option.value ? 'solid' : 'outline'"
              :label="option.label"
              @click="setFilter(option.value)"
            />
          </UButtonGroup>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <ApiErrorState
        v-if="errorMessage"
        :message="errorMessage"
        @retry="refresh()"
      />

      <template v-else>
        <UTable
          :data="items"
          :columns="columns"
          :loading="isInitialLoading"
          class="flex-1"
        >
          <template #loading>
            <div class="flex items-center justify-center py-12">
              <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
            </div>
          </template>

          <template #clipId-cell="{ row }">
            <span
              class="truncate text-sm font-medium text-highlighted"
              :title="row.original.clipId"
            >
              {{ row.original.clipId }}
            </span>
          </template>

          <template #job-cell="{ row }">
            <UButton
              :to="`/pipeline/${row.original.jobId}`"
              :title="row.original.jobId"
              color="neutral"
              variant="link"
              size="xs"
              class="px-0"
              trailing-icon="i-lucide-arrow-right"
              :label="row.original.jobId.slice(0, 8)"
            />
          </template>

          <template #completedAt-cell="{ row }">
            <span
              class="text-sm text-muted"
              :title="formatDateTime(row.original.completedAt)"
            >
              {{ formatRelativeTime(row.original.completedAt) }}
            </span>
          </template>

          <template #posted-cell="{ row }">
            <UBadge
              v-if="row.original.postedAt"
              color="primary"
              variant="subtle"
              size="sm"
              icon="i-lucide-send"
              :label="`Posted ${formatRelativeTime(row.original.postedAt)}`"
              :title="formatDateTime(row.original.postedAt)"
            />
            <span v-else class="text-sm text-dimmed">—</span>
          </template>

          <template #action-cell="{ row }">
            <UButton
              type="button"
              size="xs"
              variant="ghost"
              :color="row.original.postedAt ? 'neutral' : 'primary'"
              :icon="row.original.postedAt ? 'i-lucide-undo-2' : 'i-lucide-send'"
              :label="row.original.postedAt ? 'Unmark' : 'Mark posted'"
              :loading="pendingKeys.has(outputKey(row.original))"
              @click="togglePosted(row.original)"
            />
          </template>

          <template #empty>
            <div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <UIcon name="i-lucide-send" class="size-10 text-dimmed" />
              <p class="text-sm font-medium text-highlighted">
                {{ emptyTitle }}
              </p>
              <p class="text-sm text-muted">
                Clips from completed runs appear here once they finish.
              </p>
            </div>
          </template>
        </UTable>

        <div
          v-if="total > PAGE_SIZE"
          class="flex items-center justify-between gap-3 border-t border-default pt-4"
        >
          <p class="text-sm text-muted">
            {{ rangeLabel }}
          </p>
          <UPagination
            v-model:page="page"
            :items-per-page="PAGE_SIZE"
            :total="total"
          />
        </div>
      </template>
    </template>
  </UDashboardPanel>
</template>
