import React from 'react'
import { ImeTextarea } from '@/lib/ime-text-field'
import type { ComposerProps } from './Composer'

/**
 * A plain textarea standing in for Composer in tests, with its keys: Cmd/Ctrl+Enter submits and
 * Escape cancels. The rich editor itself does not run under happy-dom. Use it through vi.mock:
 * vi.mock('@/components/composer/Composer', async () => ({
 *   Composer: (await import('@/components/composer/composer-test-double')).ComposerTestDouble
 * }))
 */
export function ComposerTestDouble(props: ComposerProps): React.JSX.Element {
  return (
    <ImeTextarea
      data-composer={props.context}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel ?? props.placeholder}
      value={props.value}
      disabled={props.disabled}
      autoFocus={props.autoFocus}
      onChange={(event) => props.onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          props.onSubmit?.()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          props.onCancel?.()
        }
      }}
    />
  )
}
