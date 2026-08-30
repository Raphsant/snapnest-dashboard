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

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60]
]

/**
 * Compact relative stamp ("3d ago", "5m ago"). Snapshot only — it does not tick,
 * so pair it with a `title` carrying the absolute formatDateTime value.
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const magnitude = Math.abs(seconds)
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
    style: 'narrow'
  })

  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (magnitude >= secondsPerUnit) {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit)
    }
  }

  return formatter.format(seconds, 'second')
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

export function formatBytes(sizeBytes: string | number): string {
  const bytes = Number(sizeBytes)
  if (!Number.isFinite(bytes) || bytes < 0) {
    return String(sizeBytes)
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

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be'
])

/**
 * Lenient client-side gate for the start-run form. The backend is the real
 * validator — this only catches obviously-wrong input before the POST.
 */
export function isLikelyYoutubeUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }

  return (url.protocol === 'http:' || url.protocol === 'https:')
    && YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
}

/** Extract the video id from common YouTube URL shapes, or null if unparseable. */
export function youtubeVideoId(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return id || null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const vParam = url.searchParams.get('v')
    if (vParam) {
      return vParam
    }

    const match = url.pathname.match(/^\/(?:shorts|embed|v)\/([^/]+)/)
    if (match) {
      return match[1] ?? null
    }
  }

  return null
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

/** Pull an HTTP status off an ofetch error, tolerating `status` or `statusCode`. */
export function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode
  }

  return undefined
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
