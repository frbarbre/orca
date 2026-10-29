// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { createLowlight, common } from 'lowlight'
import { RichMarkdownCodeBlockLowlight } from './rich-markdown-lowlight'

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

function createEditor(text: string): Editor {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      RichMarkdownCodeBlockLowlight.configure({ lowlight: createLowlight(common) })
    ],
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
  })
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.atEnd(editor.state.doc)))
  return editor
}

// Why this shape: Monaco and VS Code put the language in `vscode-editor-data` beside the text.
function pasteFromCodeEditor(target: Editor, text: string): boolean {
  const data: Record<string, string> = {
    'text/plain': text,
    'vscode-editor-data': JSON.stringify({ mode: 'python' })
  }
  const event = { clipboardData: { getData: (type: string) => data[type] ?? '' } }
  return Boolean(
    target.view.someProp('handlePaste', (handle) =>
      handle(target.view, event as unknown as ClipboardEvent, target.state.doc.slice(0, 0))
    )
  )
}

describe('pasting code copied from an editor', () => {
  it('inserts a single line as text where the cursor is', () => {
    const target = createEditor("I've renamed the method to ")

    expect(pasteFromCodeEditor(target, 'get_restored_or_create_base_layer_from_cmd')).toBe(true)

    expect(target.getJSON().content).toEqual([
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: "I've renamed the method to get_restored_or_create_base_layer_from_cmd"
          }
        ]
      }
    ])
  })

  it('makes several lines a code block in their language', () => {
    const target = createEditor('Like this:')

    pasteFromCodeEditor(target, 'def a():\n    return 1')

    expect(target.getJSON().content).toContainEqual({
      type: 'codeBlock',
      attrs: { language: 'python' },
      content: [{ type: 'text', text: 'def a():\n    return 1' }]
    })
  })
})
