// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@tiptap/core'
import { Slice } from '@tiptap/pm/model'
import { createRichMarkdownExtensions } from '@/components/editor/rich-markdown-extensions'
import { createRichMarkdownEditorCodec } from '@/components/editor/rich-markdown-source-transport'
import { ReviewAssetUpload } from './review-asset-upload-extension'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() }
}))

const VIDEO_URL = 'https://github.com/user-attachments/assets/4d400186-c984-470b-b03f-2a44d5d034c5'

let editor: Editor | null = null
let finishUpload: (result: { ok: true; url: string; kind: 'video' }) => void = () => undefined

function mountEditor(onUploadingChange: (uploading: boolean) => void): Editor {
  const host = document.createElement('div')
  document.body.appendChild(host)
  editor = new Editor({
    element: host,
    extensions: [
      ...createRichMarkdownExtensions({ codec: createRichMarkdownEditorCodec() }),
      ReviewAssetUpload.configure({
        onUploadingChange,
        resolveRepo: () => Promise.resolve({ owner: 'acme', repo: 'widgets' })
      })
    ],
    content: 'Please test this.',
    contentType: 'markdown'
  })
  return editor
}

function paste(target: Editor, file: File): void {
  const event = new ClipboardEvent('paste')
  Object.defineProperty(event, 'clipboardData', { value: { files: [file] } })
  target.view.someProp('handlePaste', (handle) => handle(target.view, event, Slice.empty))
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve()
  }
}

describe('ReviewAssetUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('api', {
      pendingReview: {
        uploadAsset: () =>
          new Promise((resolve) => {
            finishUpload = resolve
          })
      }
    })
  })

  afterEach(() => {
    editor?.destroy()
    editor = null
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('keeps a pending video out of the markdown, then adds its link once the upload lands', async () => {
    const uploading = vi.fn()
    const target = mountEditor(uploading)
    target.commands.focus('end')

    // Why this name: ".mov" is a real top-level domain, so autolink once split the placeholder text.
    paste(
      target,
      new File(['x'], 'Screen Recording 2026-09-30 at 09.07.49.mov', { type: 'video/quicktime' })
    )
    await flush()

    expect(uploading).toHaveBeenLastCalledWith(true)
    expect(target.getMarkdown()).not.toContain('09.07.49')
    expect(target.view.dom.querySelector('.review-asset-pending-video')?.textContent).toContain(
      '09.07.49.mov'
    )

    finishUpload({ ok: true, url: VIDEO_URL, kind: 'video' })
    await flush()

    expect(uploading).toHaveBeenLastCalledWith(false)
    expect(target.getMarkdown()).toContain(VIDEO_URL)
    expect(target.view.dom.querySelector('.review-asset-pending-video')).toBeNull()
  })
})
