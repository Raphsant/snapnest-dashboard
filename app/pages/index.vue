<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { AdminAgency } from '~/types/admin'
import { formatDate, getFetchErrorMessage } from '~/utils/format'

const api = useApi()

const { data: agencies, status, error, refresh } = await useAsyncData(
  'admin-agencies',
  () => api<AdminAgency[]>('/admin/agencies')
)

const errorMessage = computed(() =>
  error.value ? getFetchErrorMessage(error.value) : null
)

const columns: TableColumn<AdminAgency>[] = [{
  accessorKey: 'name',
  header: 'Name'
}, {
  id: 'members',
  header: 'Members',
  accessorFn: row => row._count.memberships
}, {
  id: 'folders',
  header: 'Folders',
  accessorFn: row => row._count.folders
}, {
  accessorKey: 'createdAt',
  header: 'Created',
  cell: ({ row }) => formatDate(row.getValue('createdAt') as string)
}]

function onSelectAgency(_event: Event, row: TableRow<AdminAgency>) {
  navigateTo(`/agencies/${row.original.id}`)
}
</script>

<template>
  <UDashboardPanel id="agencies">
    <template #header>
      <UDashboardNavbar title="Agencies">
        <template #leading>
          <UDashboardSidebarCollapse />
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
        :data="agencies ?? []"
        :columns="columns"
        :loading="status === 'pending'"
        :on-select="onSelectAgency"
        class="flex-1"
      >
        <template #loading>
          <div class="flex items-center justify-center py-12">
            <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
          </div>
        </template>

        <template #empty>
          <div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <UIcon name="i-lucide-building-2" class="size-10 text-dimmed" />
            <p class="text-sm font-medium text-highlighted">
              No agencies yet
            </p>
            <p class="text-sm text-muted">
              Agencies created in the admin API will appear here.
            </p>
          </div>
        </template>
      </UTable>
    </template>
  </UDashboardPanel>
</template>
