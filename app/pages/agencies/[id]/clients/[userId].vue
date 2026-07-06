<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type {
  AdminAgency,
  AdminAgencyFolder,
  AdminAgencyMember,
  AgencyFolderTypeOption,
  CreateAgencyFolderRequest
} from '~/types/admin'
import { AGENCY_FOLDER_TYPE_OPTIONS } from '~/types/admin'
import { displayName, formatFolderType, getFetchErrorMessage } from '~/utils/format'

const route = useRoute()
const agencyId = route.params.id as string
const userId = route.params.userId as string
const api = useApi()
const toast = useToast()

const { data, status, error, refresh } = await useAsyncData(
  `admin-client-${agencyId}-${userId}`,
  async () => {
    const [agencies, members, folders] = await Promise.all([
      api<AdminAgency[]>('/admin/agencies'),
      api<AdminAgencyMember[]>(`/admin/agencies/${agencyId}/members`),
      api<AdminAgencyFolder[]>(`/admin/agencies/${agencyId}/members/${userId}/folders`)
    ])

    const agency = agencies.find(item => item.id === agencyId)
    if (!agency) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agency not found'
      })
    }

    const member = members.find(item => item.userId === userId)
    if (!member) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Client not found in this agency'
      })
    }

    return { agency, member, folders }
  }
)

const errorMessage = computed(() =>
  error.value ? getFetchErrorMessage(error.value) : null
)

const clientLabel = computed(() => {
  const queryName = route.query.clientName
  if (typeof queryName === 'string' && queryName.length > 0) {
    return queryName
  }
  if (data.value) {
    return displayName(data.value.member.user.firstName, data.value.member.user.email)
  }
  return 'Client'
})

const agencyLabel = computed(() => {
  const queryName = route.query.agencyName
  if (typeof queryName === 'string' && queryName.length > 0) {
    return queryName
  }
  return data.value?.agency.name ?? 'Agency'
})

const breadcrumbItems = computed((): BreadcrumbItem[] => [{
  label: 'Agencies',
  to: '/'
}, {
  label: agencyLabel.value,
  to: `/agencies/${agencyId}`
}, {
  label: clientLabel.value
}])

const pageTitle = computed(() => {
  if (!data.value) {
    return clientLabel.value
  }
  return displayName(
    data.value.member.user.firstName,
    data.value.member.user.email
  )
})

const pageSubtitle = computed(() => data.value?.member.user.email ?? '')

function openFolder(folderId: string) {
  navigateTo({
    path: `/folders/${folderId}`,
    query: {
      agencyName: agencyLabel.value,
      agencyId,
      clientName: clientLabel.value,
      clientId: userId
    }
  })
}

const newFolderOpen = ref(false)
const folderName = ref('')
const folderType = ref<AgencyFolderTypeOption>('AGENCY_RAW')
const newFolderError = ref<string | null>(null)
const newFolderLoading = ref(false)

const folderTypeItems = AGENCY_FOLDER_TYPE_OPTIONS.map(option => ({
  label: option.label,
  value: option.value
}))

function openNewFolder() {
  folderName.value = ''
  folderType.value = 'AGENCY_RAW'
  newFolderError.value = null
  newFolderOpen.value = true
}

async function submitNewFolder() {
  newFolderError.value = null
  newFolderLoading.value = true

  try {
    const body: CreateAgencyFolderRequest = {
      userId,
      name: folderName.value.trim(),
      type: folderType.value
    }

    await api(`/admin/agencies/${agencyId}/folders`, {
      method: 'POST',
      body
    })

    newFolderOpen.value = false
    await refresh()

    toast.add({
      title: 'Folder created',
      description: `"${body.name}" was added for this client.`,
      color: 'success'
    })
  } catch (err: unknown) {
    newFolderError.value = getFetchErrorMessage(err)
  } finally {
    newFolderLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel :id="`client-${userId}`">
    <template #header>
      <UDashboardNavbar :title="pageTitle">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <div class="flex flex-col gap-2">
            <UBreadcrumb :items="breadcrumbItems" />
            <p v-if="pageSubtitle" class="text-sm text-muted">
              {{ pageSubtitle }}
            </p>
          </div>
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

      <section v-else-if="data">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-highlighted">
            Folders
          </h2>
          <UButton
            icon="i-lucide-folder-plus"
            size="sm"
            @click="openNewFolder"
          >
            New folder
          </UButton>
        </div>

        <div
          v-if="data.folders.length > 0"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <UCard
            v-for="folder in data.folders"
            :key="folder.id"
            class="cursor-pointer transition-colors hover:bg-elevated/50"
            :ui="{ body: 'space-y-3' }"
            @click="openFolder(folder.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">
                  {{ folder.name }}
                </p>
                <p class="mt-1 text-xs text-muted">
                  {{ folder._count.files }} {{ folder._count.files === 1 ? 'file' : 'files' }}
                </p>
              </div>
              <UIcon name="i-lucide-folder" class="size-5 shrink-0 text-dimmed" />
            </div>

            <UBadge
              color="neutral"
              variant="subtle"
              :label="formatFolderType(folder.type)"
            />
          </UCard>
        </div>

        <div
          v-else
          class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-default py-16 text-center"
        >
          <UIcon name="i-lucide-folder-open" class="size-10 text-dimmed" />
          <p class="text-sm font-medium text-highlighted">
            No folders yet
          </p>
          <p class="text-sm text-muted">
            Create a folder for this client to get started.
          </p>
        </div>
      </section>

      <UModal v-model:open="newFolderOpen" title="New folder">
        <template #body>
          <UAlert
            v-if="newFolderError"
            color="error"
            variant="subtle"
            :title="newFolderError"
            class="mb-4"
          />

          <form class="space-y-4" @submit.prevent="submitNewFolder">
            <UFormField label="Name" required>
              <UInput
                v-model="folderName"
                placeholder="Brand Assets"
                required
              />
            </UFormField>

            <UFormField label="Type" required>
              <USelect
                v-model="folderType"
                :items="folderTypeItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="newFolderOpen = false"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                :loading="newFolderLoading"
              >
                Create folder
              </UButton>
            </div>
          </form>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
