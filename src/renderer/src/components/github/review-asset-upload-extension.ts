import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { reviewAssetKind } from '../../../../shared/github/review-asset'
import type { GitHubRepositoryIdentity } from '../../../../shared/github/pull-request-types'

export type ReviewAssetUploadOptions = {
  isEnabled: () => boolean
  onUploadingChange: (uploading: boolean) => void
  resolveRepo: () => Promise<GitHubRepositoryIdentity | null>
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

type PendingVideoMeta = { add: { id: string; pos: number; label: string } } | { remove: string }

const pendingVideoKey = new PluginKey<DecorationSet>('reviewAssetPendingVideo')

function pendingVideoWidget(label: string): HTMLElement {
  const element = document.createElement('span')
  element.className = 'review-asset-pending-video'
  element.contentEditable = 'false'
  element.textContent = label
  return element
}

// Why after the block: a video link is its own paragraph, and dropping it mid-sentence would split a word.
function afterTextblock(state: EditorState, pos: number): number {
  const $pos = state.doc.resolve(Math.min(pos, state.doc.content.size))
  return $pos.depth > 0 && $pos.parent.isTextblock ? $pos.after() : pos
}

function findPendingVideo(state: EditorState, id: string): number | null {
  const found = pendingVideoKey
    .getState(state)
    ?.find(undefined, undefined, (spec) => spec.id === id)
  return found?.[0]?.from ?? null
}

async function uploadFile(
  file: File,
  resolveRepo: () => Promise<GitHubRepositoryIdentity | null>
): Promise<{ url: string } | { error: string }> {
  try {
    const repo = await resolveRepo()
    if (!repo) {
      return {
        error: translate(
          'auto.components.github.reviewAssets.noRepository',
          'This workspace has no GitHub repository to attach the file to.'
        )
      }
    }
    const result = await window.api.pendingReview.uploadAsset({
      name: file.name,
      contentType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      repo
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
    return {
      isEnabled: () => true,
      onUploadingChange: () => undefined,
      resolveRepo: () => Promise.resolve(null)
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const options = this.options
    let pending = 0
    const settle = (delta: number): void => {
      pending += delta
      options.onUploadingChange(pending > 0)
    }

    const attach = (files: File[], at: number | null): void => {
      for (const file of files) {
        const id = createBrowserUuid()
        const kind = reviewAssetKind(file.type)
        const position = at ?? editor.state.selection.from
        const previewUrl = kind === 'image' ? URL.createObjectURL(file) : null
        // Why a decoration for video: the placeholder must never be document text, or the markdown
        // could carry it (autolink splits "clip.mov" into a link, and a text search then misses it).
        if (previewUrl) {
          editor
            .chain()
            .focus()
            .insertContentAt(position, {
              type: 'image',
              attrs: { src: previewUrl, alt: file.name, title: `${UPLOADING_TITLE}${id}` }
            })
            .run()
        } else {
          const meta: PendingVideoMeta = {
            add: {
              id,
              pos: afterTextblock(editor.state, position),
              label: translate(
                'auto.components.github.reviewAssets.uploadingLine',
                'Uploading {{name}}…',
                {
                  name: file.name
                }
              )
            }
          }
          editor.view.dispatch(editor.state.tr.setMeta(pendingVideoKey, meta))
        }
        settle(1)
        void uploadFile(file, options.resolveRepo).then((result) => {
          if (editor.isDestroyed) {
            settle(-1)
            return
          }
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
            const pos = findPendingVideo(editor.state, id)
            const remove: PendingVideoMeta = { remove: id }
            editor.view.dispatch(editor.state.tr.setMeta(pendingVideoKey, remove))
            if (pos !== null && 'url' in result) {
              editor
                .chain()
                .insertContentAt(pos, {
                  type: 'paragraph',
                  content: [{ type: 'text', text: result.url }]
                })
                .run()
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
      new Plugin<DecorationSet>({
        key: pendingVideoKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            const mapped = set.map(tr.mapping, tr.doc)
            const meta: PendingVideoMeta | undefined = tr.getMeta(pendingVideoKey)
            if (!meta) {
              return mapped
            }
            if ('remove' in meta) {
              return mapped.remove(
                mapped.find(undefined, undefined, (spec) => spec.id === meta.remove)
              )
            }
            const pos = Math.min(meta.add.pos, tr.doc.content.size)
            return mapped.add(tr.doc, [
              Decoration.widget(pos, () => pendingVideoWidget(meta.add.label), { id: meta.add.id })
            ])
          }
        },
        props: {
          decorations: (state) => pendingVideoKey.getState(state),
          handlePaste: (_view, event) => {
            const files = mediaFiles(event.clipboardData?.files)
            if (files.length === 0 || !options.isEnabled()) {
              return false
            }
            attach(files, null)
            return true
          },
          handleDrop: (view, event) => {
            const files = mediaFiles(event.dataTransfer?.files)
            if (files.length === 0 || !options.isEnabled()) {
              return false
            }
            const target = view.posAtCoords({ left: event.clientX, top: event.clientY })
            attach(files, target?.pos ?? null)
            return true
          }
        }
      })
    ]
  }
})
