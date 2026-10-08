import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { WorkspaceEmojiSuggestion } from '@/lib/workspace-emoji-shortcodes'

const LIST_MAX_HEIGHT_PX = 256

function HighlightedShortcode({ shortcode, query }: { shortcode: string; query: string }) {
  const index = shortcode.indexOf(query)
  if (index === -1 || !query) {
    return <>:{shortcode}:</>
  }
  return (
    <>
      :{shortcode.slice(0, index)}
      <mark className="rounded-[2px] bg-transparent font-semibold text-foreground">
        {shortcode.slice(index, index + query.length)}
      </mark>
      {shortcode.slice(index + query.length)}:
    </>
  )
}

export function EmojiShortcodeList({
  suggestions,
  query,
  activeIndex,
  anchor,
  onPick
}: {
  suggestions: readonly WorkspaceEmojiSuggestion[]
  query: string
  activeIndex: number
  anchor: { left: number; top: number; bottom: number }
  onPick: (suggestion: WorkspaceEmojiSuggestion) => void
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-emoji-index="${activeIndex}"]`)
      ?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])
  const placeAbove = anchor.top > LIST_MAX_HEIGHT_PX + 12
  // Why a portal: comment boxes sit inside rounded, overflow-hidden frames and Monaco view zones.
  return createPortal(
    <div
      ref={listRef}
      role="listbox"
      data-emoji-shortcode-list=""
      style={{
        position: 'fixed',
        left: anchor.left,
        width: 300,
        maxHeight: LIST_MAX_HEIGHT_PX,
        ...(placeAbove
          ? { bottom: window.innerHeight - anchor.top + 4 }
          : { top: anchor.bottom + 4 })
      }}
      className="z-[1000] overflow-y-auto rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg scrollbar-sleek"
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.shortcode}
          role="option"
          data-emoji-index={index}
          aria-selected={index === activeIndex}
          type="button"
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(suggestion)
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-muted-foreground',
            index === activeIndex && 'bg-accent text-accent-foreground'
          )}
        >
          <span className="w-5 shrink-0 text-center text-[16px] leading-none">
            {suggestion.emoji}
          </span>
          <span className="min-w-0 truncate">
            <HighlightedShortcode shortcode={suggestion.shortcode} query={query} />
          </span>
        </button>
      ))}
    </div>,
    document.body
  )
}
