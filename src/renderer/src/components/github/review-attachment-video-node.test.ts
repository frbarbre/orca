// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createRichMarkdownExtensions } from '@/components/editor/rich-markdown-extensions'
import { createRichMarkdownEditorCodec } from '@/components/editor/rich-markdown-source-transport'
import { ReviewAssetUpload } from './review-asset-upload-extension'

const VIDEO_URL = 'https://github.com/user-attachments/assets/16f4dcf7-868e-4800-99a1-b41bf47e8020'

let editor: Editor | null = null

function mountEditor(content: string): Editor {
  const host = document.createElement('div')
  document.body.appendChild(host)
  editor = new Editor({
    element: host,
    extensions: [
      ...createRichMarkdownExtensions({ codec: createRichMarkdownEditorCodec() }),
      ReviewAssetUpload
    ],
    content,
    contentType: 'markdown'
  })
  return editor
}

function nodeTypes(target: Editor): string[] {
  const types: string[] = []
  target.state.doc.forEach((node) => types.push(node.type.name))
  return types
}

describe('review attachment video', () => {
  afterEach(() => {
    editor?.destroy()
    editor = null
    document.body.replaceChildren()
  })

  it('shows a video link on its own line as one video block and keeps the link in the markdown', () => {
    const target = mountEditor(`Looks off here:\n\n${VIDEO_URL}\n\nThanks`)

    expect(nodeTypes(target)).toEqual(['paragraph', 'reviewAttachmentVideo', 'paragraph'])
    expect(target.getMarkdown()).toBe(`Looks off here:\n\n${VIDEO_URL}\n\nThanks`)
  })

  it('removes the whole video with one backspace', () => {
    const target = mountEditor(`Looks off here:\n\n${VIDEO_URL}\n\nThanks`)
    let videoPos = -1
    target.state.doc.forEach((node, offset) => {
      if (node.type.name === 'reviewAttachmentVideo') {
        videoPos = offset
      }
    })

    target.commands.setNodeSelection(videoPos)
    target.commands.deleteSelection()

    expect(target.getMarkdown()).not.toContain('user-attachments')
  })

  it('leaves a video link inside a sentence as text', () => {
    const target = mountEditor(`See ${VIDEO_URL} for the bug`)

    expect(nodeTypes(target)).toEqual(['paragraph'])
  })
})
