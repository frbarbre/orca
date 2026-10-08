import { Extension } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { findEmojiShortcodeQuery } from './emoji-shortcode-query'
import type { MentionQueryState } from './review-mention-extension'

export type ReviewEmojiShortcodeOptions = {
  onQueryChange: (state: MentionQueryState | null) => void
}

// Fork: the `:name` emoji picker, beside the `@` mention picker. Keys go through the mention
// extension's handler, which knows which of the two lists is open.
export const ReviewEmojiShortcode = Extension.create<ReviewEmojiShortcodeOptions>({
  name: 'reviewEmojiShortcode',

  addOptions() {
    return { onQueryChange: () => undefined }
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
            const match = findEmojiShortcodeQuery(before)
            if (!match) {
              options.onQueryChange(null)
              return
            }
            const coords = view.coordsAtPos(selection.from)
            options.onQueryChange({
              query: match.query,
              from: selection.from - (before.length - match.start),
              to: selection.from,
              left: coords.left,
              top: coords.top,
              bottom: coords.bottom
            })
          },
          destroy: () => options.onQueryChange(null)
        }),
        props: {
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
