<script setup lang="ts">
import type { BreadcrumbItem, TableColumn, TableRow } from '@nuxt/ui'
import type { AdminAgency, AdminAgencyMember, CreateMembershipRequest } from '~/types/admin'
import { displayName, formatDate, getFetchErrorMessage } from '~/utils/format'

const route = useRoute()
const agencyId = route.params.id as string
const api = useApi()
const toast = useToast()

const { data, status, error, refresh } = await useAsyncData(
  `admin-agency-${agencyId}`,
  async () => {
    const [agencies, members] = await Promise.all([
      api<AdminAgency[]>('/admin/agencies'),
      api<AdminAgencyMember[]>(`/admin/agencies/${agencyId}/members`)
    ])

    const agency = agencies.find(item => item.id === agencyId)
    if (!agency) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Agency not found'
      })
    }

    return { agency, members }
  }
)

const errorMessage = computed(() =>
  error.value ? getFetchErrorMessage(error.value) : null
)

const breadcrumbItems = computed((): BreadcrumbItem[] => [{
  label: 'Agencies',
  to: '/'
}, {
  label: data.value?.agency.name ?? 'Agency'
}])

const memberColumns: TableColumn<AdminAgencyMember>[] = [{
  id: 'firstName',
  header: 'Name',
  accessorFn: row => displayName(row.user.firstName, row.user.email)
}, {
  id: 'email',
  header: 'Email',
  accessorFn: row => row.user.email
}, {
  accessorKey: 'role',
  header: 'Role'
}, {
  id: 'folders',
  header: 'Folders',
  accessorFn: row => row._count.folders
}, {
  accessorKey: 'createdAt',
  header: 'Joined',
  cell: ({ row }) => formatDate(row.getValue('createdAt') as string)
}]

function roleColor(role: AdminAgencyMember['role']) {
  return role === 'STAFF' ? 'primary' as const : 'neutral' as const
}

function openClient(_event: Event, row: TableRow<AdminAgencyMember>) {
  const member = row.original
  navigateTo({
    path: `/agencies/${agencyId}/clients/${member.userId}`,
    query: {
      agencyName: data.value?.agency.name,
      clientName: displayName(member.user.firstName, member.user.email)
    }
  })
}

const addMemberOpen = ref(false)
const memberEmail = ref('')
const addMemberError = ref<string | null>(null)
const addMemberLoading = ref(false)

function openAddMember() {
  memberEmail.value = ''
  addMemberError.value = null
  addMemberOpen.value = true
}

async function submitAddMember() {
  addMemberError.value = null
  addMemberLoading.value = true

  try {
    const body: CreateMembershipRequest = {
      email: memberEmail.value.trim(),
      agencyId,
      role: 'CLIENT'
    }

    await api('/admin/agency-memberships', {
      method: 'POST',
      body
    })

    addMemberOpen.value = false
    await refresh()

    toast.add({
      title: 'Member added',
      description: `${body.email} was added to the agency.`,
      color: 'success'
    })
  } catch (err: unknown) {
    addMemberError.value = getFetchErrorMessage(err)
  } finally {
    addMemberLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel :id="`agency-${agencyId}`">
    <template #header>
      <UDashboardNavbar :title="data?.agency.name ?? 'Agency'">
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

      <section v-else-if="data">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-highlighted">
            Members
          </h2>
          <UButton
            icon="i-lucide-user-plus"
            size="sm"
            @click="openAddMember"
          >
            Add member
          </UButton>
        </div>

        <UTable
          :data="data.members"
          :columns="memberColumns"
          :on-select="openClient"
          class="flex-1"
        >
          <template #role-cell="{ row }">
            <UBadge
              :color="roleColor(row.original.role)"
              variant="subtle"
              :label="row.original.role"
            />
          </template>

          <template #empty>
            <div class="py-12 text-center text-sm text-muted">
              No members in this agency.
            </div>
          </template>
        </UTable>
      </section>

      <UModal v-model:open="addMemberOpen" title="Add member">
        <template #body>
          <UAlert
            v-if="addMemberError"
            color="error"
            variant="subtle"
            :title="addMemberError"
            class="mb-4"
          />

          <form class="space-y-4" @submit.prevent="submitAddMember">
            <UFormField label="Email" hint="Must match an existing SnapNest account">
              <UInput
                v-model="memberEmail"
                type="email"
                autocomplete="email"
                placeholder="client@example.com"
                required
              />
            </UFormField>

            <UFormField label="Role">
              <UInput
                model-value="CLIENT"
                disabled
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="addMemberOpen = false"
              >
                Cancel
              </UButton>
              <UButton
                type="submit"
                :loading="addMemberLoading"
              >
                Add member
              </UButton>
            </div>
          </form>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
