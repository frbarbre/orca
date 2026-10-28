import React from 'react'
import { Node } from '@tiptap/core'
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { X } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { safeReactNodeViewRenderer } from '@/components/editor/safe-react-node-view-renderer'
import { GitHubUserAttachmentVideo } from '@/components/sidebar/comment-markdown-github-attachment-media'
import { isGitHubAttachmentAssetUrl } from '../../../../shared/github/review-asset'

export const REVIEW_ATTACHMENT_VIDEO = 'reviewAttachmentVideo'

const OWN_LINE_ATTACHMENT_URL =
  /^(https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]{36})[ \t]*(?=\n[ \t]*\n|\n?$)/i

function ReviewAttachmentVideoView({
  node,
  selected,
  editor,
  deleteNode
}: ReactNodeViewProps): React.JSX.Element {
  const src = String(node.attrs.src)
  return (
    <NodeViewWrapper
      contentEditable={false}
      className={cn('relative my-2 w-fit rounded-md', selected && 'ring-2 ring-ring')}
    >
      <GitHubUserAttachmentVideo href={src} className="max-h-48 max-w-full rounded-md bg-black/80">
        {src}
      </GitHubUserAttachmentVideo>
      {editor.isEditable ? (
        <button
          type="button"
          aria-label={translate('auto.components.github.reviewAssets.removeVideo', 'Remove video')}
          className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black/90"
          onClick={deleteNode}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </NodeViewWrapper>
  )
}

// Why a node of its own: as text, one stray keystroke breaks the link GitHub turns into the video.
export const ReviewAttachmentVideo = Node.create({
  name: REVIEW_ATTACHMENT_VIDEO,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  markdownTokenizer: {
    name: REVIEW_ATTACHMENT_VIDEO,
    level: 'block',
    tokenize(src) {
      const match = OWN_LINE_ATTACHMENT_URL.exec(src)
      return match ? { type: REVIEW_ATTACHMENT_VIDEO, raw: match[0], text: match[1] } : undefined
    }
  },

  addAttributes() {
    return { src: { default: '' } }
  },

  parseHTML() {
    return [
      { tag: 'div[data-review-attachment-video]', getAttrs: (el) => ({ src: el.dataset.src }) }
    ]
  },

  renderHTML({ node }) {
    return ['div', { 'data-review-attachment-video': '', 'data-src': node.attrs.src }]
  },

  parseMarkdown: (token, helpers) =>
    isGitHubAttachmentAssetUrl(token.text)
      ? helpers.createNode(REVIEW_ATTACHMENT_VIDEO, { src: token.text })
      : [],

  renderMarkdown: (node) => String(node.attrs?.src ?? ''),

  addNodeView() {
    return safeReactNodeViewRenderer(ReviewAttachmentVideoView)
  }
})
