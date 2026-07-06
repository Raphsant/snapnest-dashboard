export type AdminUserSummary = {
  id: string
  email: string
  firstName: string | null
}

export type AdminAgency = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  _count: {
    memberships: number
    folders: number
  }
}

export type AgencyRole = 'CLIENT' | 'STAFF'

export type FolderType =
  | 'PERSONAL'
  | 'AGENCY_INTAKE'
  | 'AGENCY_RAW'
  | 'AGENCY_PRODUCED'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_MODIFICATIONS'

export type AdminAgencyMember = {
  id: string
  agencyId: string
  userId: string
  role: AgencyRole
  createdAt: string
  updatedAt: string
  user: AdminUserSummary
  _count: {
    folders: number
  }
}

export type CreateMembershipRequest = {
  email: string
  agencyId: string
  role: 'CLIENT'
}

export type CreateAgencyFolderRequest = {
  userId: string
  name: string
  type: AgencyFolderTypeOption
}

/** Folder types available when creating agency folders in the admin panel. */
export type AgencyFolderTypeOption = 'AGENCY_INTAKE' | 'AGENCY_RAW'

export const AGENCY_FOLDER_TYPE_OPTIONS: Array<{
  label: string
  value: AgencyFolderTypeOption
}> = [
  { label: 'Agency Intake', value: 'AGENCY_INTAKE' },
  { label: 'Agency Raw', value: 'AGENCY_RAW' }
]

export type AdminAgencyFolder = {
  id: string
  ownerId: string
  agencyId: string | null
  name: string
  type: FolderType
  parentFolderId: string | null
  createdAt: string
  updatedAt: string
  _count: {
    files: number
  }
}

export type AdminFileType = 'PHOTO' | 'VIDEO' | 'AUDIO' | 'TRANSCRIPT' | 'SUBTITLE'

export type UploadStatus = 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED'

export type AdminMediaFile = {
  id: string
  ownerId: string
  agencyId: string | null
  folderId: string | null
  fileName: string
  mimeType: string
  sizeBytes: string
  s3Key: string
  fileType: AdminFileType
  source: string
  uploadStatus: UploadStatus
  reviewStatus: string | null
  durationSeconds: number | null
  thumbnailS3Key: string | null
  createdAt: string
  updatedAt: string
  owner: AdminUserSummary
}

export type AdminFolderDetail = {
  id: string
  ownerId: string
  agencyId: string | null
  name: string
  type: FolderType
  parentFolderId: string | null
  createdAt: string
  updatedAt: string
  files: AdminMediaFile[]
}

export type AdminFileViewUrl = {
  fileId: string
  fullUrl: string
  thumbnailUrl: string | null
}

export type AdminBatchViewUrlsRequest = {
  fileIds: string[]
}
