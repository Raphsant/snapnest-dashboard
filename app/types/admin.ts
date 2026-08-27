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

export type FolderType
  = | 'PERSONAL'
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

export type PipelineJobStatus
  = | 'QUEUED'
    | 'RUNNING'
    | 'AWAITING_MANIFEST_APPROVAL'
    | 'APPROVED'
    | 'AWAITING_CREATIVE_APPROVAL'
    | 'CREATIVE_APPROVED'
    | 'COMPLETED'
    | 'FAILED'

/**
 * Manifest shape produced by the pipeline worker. Keys are snake_case to match
 * the worker output stored verbatim in the `manifest` jsonb column.
 */
export type PipelineClip = {
  id: string
  approved: boolean | null
  category: string
  confidence: string
  start_block: number
  end_block: number
  start: string
  end: string
  duration_seconds: number
  title: string
  summary: string
  rationale: string
  transcript: string
  /** New creative fields (per-clip asset picks). Absent on old jobs. */
  hook_asset_id?: string | null
  outro_asset_id?: string | null
  hook_text?: string | null
  close_text?: string | null
  /** Legacy creative prompts — worker no longer writes these; old jobs still carry them. */
  hook_prompt?: string | null
  close_prompt?: string | null
  post_copy: string | null
  beep_timestamps: number[][]
}

/** Only `category` is guaranteed by the pipeline; the rest pass through unvalidated. */
export type PipelineRejectedSegment = {
  category?: string
  start_block?: number
  end_block?: number
  topic?: string
  reason?: string
}

export type PipelineManifest = {
  source_video?: string
  srt_file?: string
  generated?: string
  status?: string
  clips: PipelineClip[]
  rejected_segments: PipelineRejectedSegment[]
}

export type PipelineSourceType = 'FILE' | 'YOUTUBE'

export type AdminPipelineJob = {
  id: string
  sourceFileId: string | null
  sourceType: PipelineSourceType
  sourceUrl: string | null
  agencyId: string
  requestedById: string
  status: PipelineJobStatus
  currentStage: string | null
  error: string | null
  manifest: PipelineManifest | null
  createdAt: string
  updatedAt: string
}

export type AdminPipelineJobListItem = AdminPipelineJob & {
  /** Null for YOUTUBE jobs — render sourceUrl / video id instead. */
  sourceFile: {
    id: string
    fileName: string
  } | null
}

export type CreateYoutubeJobRequest = {
  sourceUrl: string
}

/**
 * Delivery records attached to a pipeline output. The admin panel only
 * surfaces the count, so the inner shape is intentionally opaque here.
 */
export type PipelineOutputDelivery = Record<string, unknown>

export type AdminPipelineJobOutput = {
  clipId: string
  s3Key: string
  sizeBytes: number
  presignedUrl: string
  deliveries: PipelineOutputDelivery[]
}

/**
 * Static card definition for the /workflows landing page. Add an array entry
 * to surface another workflow — no page rewrite required.
 */
export type WorkflowDefinition = {
  id: string
  name: string
  description: string
  icon: string
  /** Route to this workflow's runs list. */
  runsTo: string
}
