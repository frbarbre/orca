import React from 'react'
import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isScreenSubmitShortcut } from '@/lib/screen-submit-shortcut'
import { hasBoundedGitHubMarkdownImageUrlText } from '@/components/github/github-markdown-image-url'
import { translate } from '@/i18n/i18n'

export function GitHubMarkdownComposerImageRow({
  imageUrl,
  imageInputRef,
  disabled,
  setImageUrl,
  onInsert,
  onClose
}: {
  imageUrl: string
  imageInputRef: React.RefObject<HTMLInputElement | null>
  disabled: boolean
  setImageUrl: (value: string) => void
  onInsert: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <form
      className="github-markdown-composer-image-row"
      onSubmit={(event) => {
        event.preventDefault()
        onInsert()
      }}
    >
      <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        ref={imageInputRef}
        value={imageUrl}
        onChange={(event) => setImageUrl(event.target.value)}
        onKeyDown={(event) => {
          if (isScreenSubmitShortcut(event)) {
            event.preventDefault()
            event.stopPropagation()
            onInsert()
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        }}
        placeholder={translate(
          'auto.components.github.GitHubMarkdownComposer.f24783f470',
          'https://...'
        )}
        disabled={disabled}
        className="h-8 min-w-0 text-xs"
      />
      <Button
        type="submit"
        size="xs"
        disabled={disabled || !hasBoundedGitHubMarkdownImageUrlText(imageUrl)}
      >
        {translate('auto.components.github.GitHubMarkdownComposer.e3bd59143c', 'Insert')}
      </Button>
      <Button type="button" variant="ghost" size="xs" onClick={onClose}>
        {translate('auto.components.github.GitHubMarkdownComposer.015b4e607d', 'Cancel')}
      </Button>
    </form>
  )
}
