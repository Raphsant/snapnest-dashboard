<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type { AdminAgency, AdminFileViewUrl, AdminFolderDetail, AdminMediaFile } from '~/types/admin'
import {
  displayName,
  fileTypeIcon,
  formatBytes,
  formatDate,
  getFetchErrorMessage
} from '~/utils/format'

const route = useRoute()
const folderId = route.params.id as string
const api = useApi()

const { data, status, error, refresh } = await useAsyncData(
  `admin-folder-${folderId}`,
  async () => {
    const [folder, agencies] = await Promise.all([
      api<AdminFolderDetail>(`/admin/folders/${folderId}`),
      api<AdminAgency[]>('/admin/agencies')
    ])

    const agency = folder.agencyId
      ? agencies.find(item => item.id === folder.agencyId) ?? null
      : null

    const fileIds = folder.files.map(file => file.id)
    let viewUrls: AdminFileViewUrl[] = []

    if (fileIds.length > 0) {
      viewUrls = await api<AdminFileViewUrl[]>('/admin/files/view-urls', {
        method: 'POST',
        body: { fileIds }
      })
    }

    const urlByFileId = new Map(viewUrls.map(item => [item.fileId, item]))

    return { folder, agency, urlByFileId }
  }
)

const errorMessage = computed(() =>
  error.value ? getFetchErrorMessage(error.value) : null
)

const breadcrumbItems = computed((): BreadcrumbItem[] => {
  const items: BreadcrumbItem[] = [{
    label: 'Agencies',
    to: '/'
  }]

  const agencyName = typeof route.query.agencyName === 'string' && route.query.agencyName.length > 0
    ? route.query.agencyName
    : data.value?.agency?.name
  const agencyRouteId = typeof route.query.agencyId === 'string' && route.query.agencyId.length > 0
    ? route.query.agencyId
    : data.value?.agency?.id

  if (agencyName && agencyRouteId) {
    items.push({
      label: agencyName,
      to: `/agencies/${agencyRouteId}`
    })
  }

  const clientName = typeof route.query.clientName === 'string' && route.query.clientName.length > 0
    ? route.query.clientName
    : null
  const clientRouteId = typeof route.query.clientId === 'string' && route.query.clientId.length > 0
    ? route.query.clientId
    : data.value?.folder.ownerId

  if (clientName && clientRouteId && agencyRouteId) {
    items.push({
      label: clientName,
      to: `/agencies/${agencyRouteId}/clients/${clientRouteId}`
    })
  }

  items.push({
    label: data.value?.folder.name ?? 'Folder'
  })

  return items
})

const viewerOpen = ref(false)
const selectedFile = ref<AdminMediaFile | null>(null)
const selectedFullUrl = ref<string | null>(null)

function openFile(file: AdminMediaFile) {
  const urls = data.value?.urlByFileId.get(file.id)
  selectedFile.value = file
  selectedFullUrl.value = urls?.fullUrl ?? null
  viewerOpen.value = true
}

function thumbnailUrl(file: AdminMediaFile): string | null {
  return data.value?.urlByFileId.get(file.id)?.thumbnailUrl
    ?? data.value?.urlByFileId.get(file.id)?.fullUrl
    ?? null
}
</script>

<template>
  <UDashboardPanel :id="`folder-${folderId}`">
    <template #header>
      <UDashboardNavbar :title="data?.folder.name ?? 'Folder'">
        <template #leading>
          <UDashboardSidebarCollapse />
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

      <div v-else-if="status === 'pending'" class="flex items-center justify-center py-24">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>

      <div
        v-else-if="data && data.folder.files.length > 0"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      >
        <button
          v-for="file in data.folder.files"
          :key="file.id"
          type="button"
          class="group flex flex-col overflow-hidden rounded-lg border border-default bg-elevated/25 text-left transition-colors hover:bg-elevated/50"
          @click="openFile(file)"
        >
          <div class="relative aspect-square bg-muted/30">
            <img
              v-if="thumbnailUrl(file)"
              :src="thumbnailUrl(file)!"
              :alt="file.fileName"
              class="size-full object-cover"
            >
            <div
              v-else
              class="flex size-full items-center justify-center"
            >
              <UIcon
                :name="fileTypeIcon(file.fileType)"
                class="size-10 text-dimmed"
              />
            </div>

            <div
              v-if="file.fileType === 'VIDEO'"
              class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20"
            >
              <UIcon name="i-lucide-play" class="size-10 text-white drop-shadow" />
            </div>
          </div>

          <div class="space-y-1 p-3">
            <p class="truncate text-sm font-medium text-highlighted" :title="file.fileName">
              {{ file.fileName }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ displayName(file.owner.firstName, file.owner.email) }}
            </p>
            <div class="flex items-center justify-between gap-2 text-xs text-dimmed">
              <span>{{ formatDate(file.createdAt) }}</span>
              <span>{{ formatBytes(file.sizeBytes) }}</span>
            </div>
          </div>
        </button>
      </div>

      <div
        v-else-if="data"
        class="flex flex-col items-center justify-center gap-2 py-24 text-center"
      >
        <UIcon name="i-lucide-images" class="size-10 text-dimmed" />
        <p class="text-sm font-medium text-highlighted">
          This folder is empty
        </p>
        <p class="text-sm text-muted">
          Uploaded files will appear here.
        </p>
      </div>

      <FileViewerModal
        v-model:open="viewerOpen"
        :file="selectedFile"
        :full-url="selectedFullUrl"
      />
    </template>
  </UDashboardPanel>
</template>
