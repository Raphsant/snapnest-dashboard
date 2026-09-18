<script setup lang="ts">
import type { PipelineClip } from '~/types/admin'

type CopyBlock = {
  /** Unique per button — drives the "Copied" state. */
  key: string
  label: string
  text: string
}

const props = defineProps<{
  clip: PipelineClip
}>()

const open = defineModel<boolean>('open', { default: false })

const toast = useToast()

const CAPTION_PLATFORMS = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' }
] as const

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim())
}

const onScreenBlocks = computed((): CopyBlock[] => {
  const blocks: CopyBlock[] = []

  if (hasText(props.clip.hook_text)) {
    blocks.push({ key: 'hook_text', label: 'Hook', text: props.clip.hook_text })
  }
  if (hasText(props.clip.close_text)) {
    blocks.push({ key: 'close_text', label: 'Outro', text: props.clip.close_text })
  }

  return blocks
})

/** Per-platform captions when present; otherwise the whole legacy post copy. */
const captionBlocks = computed((): CopyBlock[] => {
  const captions = props.clip.captions

  if (captions != null) {
    const blocks: CopyBlock[] = []
    for (const platform of CAPTION_PLATFORMS) {
      const text = captions[platform.key]
      if (hasText(text)) {
        blocks.push({ key: `captions.${platform.key}`, label: platform.label, text })
      }
    }
    if (blocks.length) {
      return blocks
    }
  }

  if (hasText(props.clip.post_copy)) {
    return [{ key: 'post_copy', label: 'Post copy', text: props.clip.post_copy }]
  }

  return []
})

const copiedKey = ref<string | null>(null)

const { start: startCopiedReset } = useTimeoutFn(() => {
  copiedKey.value = null
}, 1500, { immediate: false })

async function copyBlock(block: CopyBlock) {
  try {
    await navigator.clipboard.writeText(block.text)
    copiedKey.value = block.key
    startCopiedReset()
  } catch {
    toast.add({
      title: 'Could not copy to clipboard',
      color: 'error'
    })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="clip.title || clip.id"
    :description="clip.title ? clip.id : undefined"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <section v-if="onScreenBlocks.length" class="space-y-3">
          <h3 class="text-sm font-semibold text-highlighted">
            On-screen text
          </h3>

          <div
            v-for="block in onScreenBlocks"
            :key="block.key"
            class="space-y-1"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-medium text-muted">{{ block.label }}</span>
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="xs"
                :icon="copiedKey === block.key ? 'i-lucide-check' : 'i-lucide-copy'"
                :label="copiedKey === block.key ? 'Copied' : 'Copy'"
                @click="copyBlock(block)"
              />
            </div>
            <p class="whitespace-pre-wrap rounded-md bg-muted/50 p-2 font-mono text-xs text-default">
              {{ block.text }}
            </p>
          </div>
        </section>

        <section
          v-for="block in captionBlocks"
          :key="block.key"
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-highlighted">
              {{ block.label }}
            </h3>
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              size="xs"
              :icon="copiedKey === block.key ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copiedKey === block.key ? 'Copied' : 'Copy'"
              @click="copyBlock(block)"
            />
          </div>
          <pre class="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 font-sans text-sm text-default">{{ block.text }}</pre>
        </section>

        <p v-if="!captionBlocks.length" class="text-sm text-muted">
          No captions generated for this clip.
        </p>
      </div>
    </template>
  </UModal>
</template>
