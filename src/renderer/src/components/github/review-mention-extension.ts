import { Extension, type Editor } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'

export type MentionQueryState = {
  query: string
  from: number
  to: number
  left: number
  top: number
  bottom: number
}

export type ReviewMentionOptions = {
  onQueryChange: (state: MentionQueryState | null) => void
  onKeyDown: (event: KeyboardEvent) => boolean
  onEditor: (editor: Editor | null) => void
}

const MENTION_BEFORE_CURSOR = /(^|[\s([{,])@([A-Za-z0-9-]*)$/

export const ReviewMention = Extension.create<ReviewMentionOptions>({
  name: 'reviewMention',
  priority: 1000,

  addOptions() {
    return { onQueryChange: () => undefined, onKeyDown: () => false, onEditor: () => undefined }
  },

  onCreate() {
    this.options.onEditor(this.editor)
  },

  onDestroy() {
    this.options.onEditor(null)
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        view: () => ({
          update: (view) => {
            const { selection } = view.state
            if (!selection.empty || !view.hasFocus()) {
              options.onQueryChange(null)
              return
            }
            const $from = selection.$from
            const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼')
            const match = MENTION_BEFORE_CURSOR.exec(before)
            if (!match) {
              options.onQueryChange(null)
              return
            }
            const query = match[2] ?? ''
            const from = selection.from - query.length - 1
            const coords = view.coordsAtPos(selection.from)
            options.onQueryChange({
              query,
              from,
              to: selection.from,
              left: coords.left,
              top: coords.top,
              bottom: coords.bottom
            })
          },
          destroy: () => options.onQueryChange(null)
        }),
        props: {
          handleKeyDown: (_view, event) => options.onKeyDown(event),
          handleDOMEvents: {
            blur: () => {
              options.onQueryChange(null)
              return false
            }
          }
        }
      })
    ]
  }
})
