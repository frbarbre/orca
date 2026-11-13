import React, { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'

const ENABLED_MENU_ITEM = '[role="menuitem"]:not([data-disabled]):not([disabled])'

export function withPromptPrefix(prefix: string, prompt: string): string {
  const trimmed = prefix.trim()
  return trimmed ? `${trimmed}\n\n${prompt}` : prompt
}

function firstEnabledMenuItem(input: HTMLInputElement): HTMLElement | null {
  return (
    input.closest('[data-send-menu-prefix]')?.parentElement?.querySelector(ENABLED_MENU_ITEM) ??
    null
  )
}

// Fork: a message typed here goes in front of the prompt the menu sends.
export function SendMenuPrefixInput({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const focusOnMount = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      return
    }
    // Why a frame: the menu moves focus to itself or its first item right after mounting.
    const frame = requestAnimationFrame(() => input.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape' || event.nativeEvent.isComposing) {
      return
    }
    // Why: the menu reads letters as typeahead and arrows as navigation, which would eat typing.
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      firstEnabledMenuItem(event.currentTarget)?.click()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      firstEnabledMenuItem(event.currentTarget)?.focus()
    }
  }

  return (
    <div data-send-menu-prefix="" className="px-1 pt-1 pb-1.5">
      <Input
        ref={focusOnMount}
        density="compact"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={translate(
          'auto.components.editor.ReviewNotesSendMenuContent.prefixLabel',
          'Message for the agent'
        )}
        placeholder={translate(
          'auto.components.editor.ReviewNotesSendMenuContent.prefixPlaceholder',
          'Add a message (optional)'
        )}
      />
    </div>
  )
}
