import { Extension, type Editor } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { reviewAssetKind } from '../../../../shared/github/review-asset'

export type ReviewAssetUploadOptions = {
  isEnabled: () => boolean
  onUploadingChange: (uploading: boolean) => void
}

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

const UPLOADING_TITLE = 'uploading:'

function findUploadingImage(editor: Editor, id: string): number | null {
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (
      found === null &&
      node.type.name === 'image' &&
      node.attrs.title === `${UPLOADING_TITLE}${id}`
    ) {
      found = pos
    }
    return found === null
  })
  return found
}

function findText(editor: Editor, text: string): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found === null && node.isText && node.text?.includes(text)) {
      const from = pos + (node.text?.indexOf(text) ?? 0)
      found = { from, to: from + text.length }
    }
    return found === null
  })
  return found
}

async function uploadFile(file: File): Promise<{ url: string } | { error: string }> {
  try {
    const result = await window.api.pendingReview.uploadAsset({
      name: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer())
    })
    return result.ok ? { url: result.url } : { error: result.error }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export const ReviewAssetUpload = Extension.create<ReviewAssetUploadOptions>({
  name: 'reviewAssetUpload',
  priority: 1000,

  addOptions() {
    return { isEnabled: () => true, onUploadingChange: () => undefined }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options
    let pending = 0
    const settle = (delta: number): void => {
      pending += delta
      options.onUploadingChange(pending > 0)
    }

    const attach = async (files: File[], at: number | null): Promise<void> => {
      if (!(await isUploadConfigured())) {
        toast.error(
          translate(
            'auto.components.github.reviewAssets.notConfigured',
            'Uploads are not set up on this computer.'
          )
        )
        return
      }
      for (const file of files) {
        const id = createBrowserUuid()
        const kind = reviewAssetKind(file.type)
        const position = at ?? editor.state.selection.from
        const placeholder = translate(
          'auto.components.github.reviewAssets.uploadingLine',
          'Uploading {{name}}…',
          { name: file.name }
        )
        const previewUrl = kind === 'image' ? URL.createObjectURL(file) : null
        editor
          .chain()
          .focus()
          .insertContentAt(
            position,
            previewUrl
              ? {
                  type: 'image',
                  attrs: { src: previewUrl, alt: file.name, title: `${UPLOADING_TITLE}${id}` }
                }
              : { type: 'paragraph', content: [{ type: 'text', text: placeholder }] }
          )
          .run()
        settle(1)
        void uploadFile(file).then((result) => {
          if (previewUrl) {
            const pos = findUploadingImage(editor, id)
            if (pos !== null) {
              const tr = editor.state.tr
              if ('url' in result) {
                tr.setNodeMarkup(pos, undefined, { src: result.url, alt: file.name, title: null })
              } else {
                tr.delete(pos, pos + 1)
              }
              editor.view.dispatch(tr)
            }
            // Why delayed: the node view keeps showing the preview until the public copy has loaded.
            window.setTimeout(() => URL.revokeObjectURL(previewUrl), 30_000)
          } else {
            const range = findText(editor, placeholder)
            if (range) {
              editor.view.dispatch(
                'url' in result
                  ? editor.state.tr.insertText(result.url, range.from, range.to)
                  : editor.state.tr.delete(range.from, range.to)
              )
            }
          }
          if ('error' in result) {
            toast.error(
              translate(
                'auto.components.github.reviewAssets.uploadFailed',
                'Could not upload {{name}}. {{reason}}',
                { name: file.name, reason: result.error }
              )
            )
          }
          settle(-1)
        })
      }
    }

    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const files = mediaFiles(event.clipboardData?.files)
            if (files.length === 0 || !options.isEnabled()) {
              return false
            }
            void attach(files, null)
            return true
          },
          handleDrop: (view, event) => {
            const files = mediaFiles(event.dataTransfer?.files)
            if (files.length === 0 || !options.isEnabled()) {
              return false
            }
            const target = view.posAtCoords({ left: event.clientX, top: event.clientY })
            void attach(files, target?.pos ?? null)
            return true
          }
        }
      })
    ]
  }
})
