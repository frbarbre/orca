import React, { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { reviewAssetKind, reviewAssetMarkdown } from '../../../../shared/github/review-asset'

const DROP_TARGET_PROPS = { 'data-review-asset-drop': '' } as const

type PendingUpload = { id: string; name: string; previewUrl: string; kind: 'image' | 'video' }

let configured: Promise<boolean> | null = null
function isUploadConfigured(): Promise<boolean> {
  configured ??=
    window.api?.pendingReview?.assetUploadConfigured?.().catch(() => false) ??
    Promise.resolve(false)
  return configured
}

function mediaFiles(list: FileList | null | undefined): File[] {
  return list ? [...list].filter((file) => reviewAssetKind(file.type) !== null) : []
}

export type ReviewAssetAttachments = {
  /** True while any attachment is still uploading, so the box must not be sent yet. */
  uploading: boolean
  /** Spread onto the textarea so the preload hands file drops to it. */
  dropTargetProps: { 'data-review-asset-drop': '' }
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onDragOver: (event: React.DragEvent<HTMLTextAreaElement>) => void
  onDrop: (event: React.DragEvent<HTMLTextAreaElement>) => void
  previews: React.JSX.Element | null
}

export function useReviewAssetAttachments({
  value,
  setValue,
  textareaRef,
  enabled = true
}: {
  value: string
  setValue: (next: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  enabled?: boolean
}): ReviewAssetAttachments {
  const [pending, setPending] = useState<PendingUpload[]>([])
  // Why a ref: an upload finishes after further typing, and must edit the text as it is then.
  const latest = useRef({ value, setValue })
  useEffect(() => {
    latest.current = { value, setValue }
  }, [setValue, value])

  const write = useCallback((next: string) => {
    // Why updated at once: two uploads can finish in the same tick, before React re-renders.
    latest.current = { ...latest.current, value: next }
    latest.current.setValue(next)
  }, [])

  const replacePlaceholder = useCallback(
    (placeholder: string, replacement: string) => {
      const current = latest.current.value
      if (current.includes(placeholder)) {
        write(current.replace(placeholder, replacement))
      }
    },
    [write]
  )

  const attach = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || !(await isUploadConfigured())) {
        return
      }
      const textarea = textareaRef.current
      const caret = textarea?.selectionStart ?? latest.current.value.length
      const uploads = files.map((file) => ({
        file,
        id: createBrowserUuid(),
        kind: reviewAssetKind(file.type) ?? 'image'
      }))
      const placeholders = uploads.map(
        ({ file, id }) => `![Uploading ${file.name.replace(/[[\]]/g, '')}…](uploading:${id})`
      )
      const current = latest.current.value
      const inserted = placeholders.join('\n')
      write(`${current.slice(0, caret)}${inserted}${current.slice(caret)}`)
      setPending((items) => [
        ...items,
        ...uploads.map(({ file, id, kind }) => ({
          id,
          name: file.name,
          kind,
          previewUrl: URL.createObjectURL(file)
        }))
      ])
      await Promise.all(
        uploads.map(async ({ file, id }, index) => {
          const placeholder = placeholders[index]
          try {
            const result = await window.api.pendingReview.uploadAsset({
              name: file.name,
              contentType: file.type,
              bytes: new Uint8Array(await file.arrayBuffer())
            })
            if (result.ok) {
              replacePlaceholder(
                placeholder,
                reviewAssetMarkdown(result.kind, file.name, result.url)
              )
            } else {
              replacePlaceholder(placeholder, '')
              toast.error(result.error)
            }
          } catch (error) {
            replacePlaceholder(placeholder, '')
            toast.error(
              translate(
                'auto.components.github.reviewAssets.failed',
                'Could not upload {{name}}.',
                {
                  name: file.name
                }
              ) + (error instanceof Error ? ` ${error.message}` : '')
            )
          } finally {
            setPending((items) => {
              const done = items.find((item) => item.id === id)
              if (done) {
                URL.revokeObjectURL(done.previewUrl)
              }
              return items.filter((item) => item.id !== id)
            })
          }
        })
      )
    },
    [replacePlaceholder, textareaRef, write]
  )

  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = enabled ? mediaFiles(event.clipboardData?.files) : []
      if (files.length > 0) {
        event.preventDefault()
        void attach(files)
      }
    },
    [attach, enabled]
  )
  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      if (enabled && [...event.dataTransfer.types].includes('Files')) {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }
    },
    [enabled]
  )
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLTextAreaElement>) => {
      if (![...event.dataTransfer.types].includes('Files')) {
        return
      }
      // Why always prevented: the preload lets file drops through to this box, and an unhandled
      // one would make the window open the file.
      event.preventDefault()
      event.stopPropagation()
      const files = enabled ? mediaFiles(event.dataTransfer.files) : []
      if (files.length > 0) {
        void attach(files)
      }
    },
    [attach, enabled]
  )

  const previews =
    pending.length > 0 ? (
      <div className="flex flex-wrap gap-1.5 px-2 pb-2" data-review-asset-previews="">
        {pending.map((item) => (
          <div
            key={item.id}
            className="relative size-14 overflow-hidden rounded border border-border bg-muted"
            title={translate(
              'auto.components.github.reviewAssets.uploading',
              'Uploading {{name}}…',
              {
                name: item.name
              }
            )}
          >
            {item.kind === 'image' ? (
              <img src={item.previewUrl} alt={item.name} className="size-full object-cover" />
            ) : (
              <video src={item.previewUrl} muted className="size-full object-cover" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-background/50">
              <LoaderCircle className="size-4 animate-spin" />
            </span>
          </div>
        ))}
      </div>
    ) : null

  return {
    uploading: pending.length > 0,
    dropTargetProps: DROP_TARGET_PROPS,
    onPaste,
    onDragOver,
    onDrop,
    previews
  }
}
