import type { AdminFileType, PipelineJobStatus } from '~/types/admin'

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '—'
  }

  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const secs = total % 60

  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function formatBytes(sizeBytes: string): string {
  const bytes = Number(sizeBytes)
  if (!Number.isFinite(bytes) || bytes < 0) {
    return sizeBytes
  }
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / Math.pow(1024, unitIndex)

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatFolderType(type: string): string {
  return formatEnumLabel(type)
}

export function fileTypeIcon(fileType: AdminFileType): string {
  switch (fileType) {
    case 'PHOTO':
      return 'i-lucide-image'
    case 'VIDEO':
      return 'i-lucide-video'
    default:
      return 'i-lucide-file'
  }
}

export function displayName(firstName: string | null | undefined, email: string): string {
  const trimmed = firstName?.trim()
  return trimmed || email
}

export function getFetchErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('data' in error) {
      const data = (error as { data: unknown }).data
      if (data && typeof data === 'object' && 'message' in data) {
        const message = (data as { message: unknown }).message
        if (typeof message === 'string') {
          return message
        }
        if (Array.isArray(message)) {
          return message.map(String).join(', ')
        }
      }
    }

    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      const message = (error as { message: string }).message
      if (message.includes('fetch failed') || message.includes('Failed to fetch')) {
        return 'Could not reach the server. Check that the backend is running.'
      }
      return message
    }
  }

  return 'Something went wrong. Please try again.'
}

export function pipelineStatusColor(status: PipelineJobStatus) {
  switch (status) {
    case 'RUNNING':
      return 'info' as const
    case 'AWAITING_MANIFEST_APPROVAL':
    case 'AWAITING_CREATIVE_APPROVAL':
      return 'warning' as const
    case 'APPROVED':
    case 'CREATIVE_APPROVED':
      return 'primary' as const
    case 'COMPLETED':
      return 'success' as const
    case 'FAILED':
      return 'error' as const
    default:
      return 'neutral' as const
  }
}

export function clipConfidenceColor(confidence: string) {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'success' as const
    case 'borderline':
      return 'warning' as const
    default:
      return 'neutral' as const
  }
}
