import React, { useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { RichMarkdownTableControls } from '@/components/editor/RichMarkdownTableControls'

export function GitHubMarkdownComposerEditorPane({
  disabled,
  editor,
  growWithContent = false
}: {
  disabled: boolean
  editor: Editor | null
  growWithContent?: boolean
}): React.JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'relative',
        !growWithContent && 'max-h-[360px] overflow-y-auto scrollbar-sleek'
      )}
    >
      <EditorContent editor={editor} />
      <RichMarkdownTableControls
        disabled={disabled}
        editor={editor}
        scrollContainerRef={scrollContainerRef}
      />
    </div>
  )
}
