import React, { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'

const ENABLED_MENU_ITEM = '[role="menuitem"]:not([data-disabled]):not([disabled])'

export function withPromptPrefix(prefix: string, prompt: string): string {
  const trimmed = prefix.trim()
  return trimmed ? `${trimmed}\n\n${prompt}` : prompt
}

// Fork: a message typed here goes in front of the prompt the menu sends.
export function SendMenuPrefixInput({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Why a frame: the menu moves focus to itself or its first item after this effect runs.
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const firstEnabledItem = (): HTMLElement | null =>
    wrapperRef.current?.parentElement?.querySelector<HTMLElement>(ENABLED_MENU_ITEM) ?? null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape' || event.nativeEvent.isComposing) {
      return
    }
    // Why: the menu reads letters as typeahead and arrows as navigation, which would eat typing.
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      firstEnabledItem()?.click()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      firstEnabledItem()?.focus()
    }
  }

  return (
    <div ref={wrapperRef} className="px-1 pt-1 pb-1.5">
      <Input
        ref={inputRef}
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
