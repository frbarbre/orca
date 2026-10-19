import React from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'

/** Fork: copies one note or one reply as written (markdown), never the thread around it. */
export function CopyMessageButton({ text }: { text: string }): React.JSX.Element {
  const label = translate('auto.components.diff.comments.CopyMessageButton.copy', 'Copy message')
  return (
    <button
      type="button"
      className="orca-diff-comment-pill-btn"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void window.api.ui
          .writeClipboardText(text)
          .then(() =>
            toast.success(
              translate('auto.components.diff.comments.CopyMessageButton.copied', 'Copied')
            )
          )
      }}
    >
      <Copy className="size-3" />
    </button>
  )
}
