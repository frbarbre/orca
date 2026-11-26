import { useLayoutEffect, useRef } from 'react'
import type { ITheme } from '@xterm/xterm'
import { File, Folder, SlidersHorizontal, SquareTerminal, Type } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  completionKind,
  completionLabel,
  type CompletionMenu,
  type ShellCompletion,
  type ShellCompletionKind
} from './shell-editor-completion'

const KIND_ICONS: Record<ShellCompletionKind, typeof Folder> = {
  folder: Folder,
  file: File,
  command: SquareTerminal,
  option: SlidersHorizontal,
  other: Type
}

function describe(entry: ShellCompletion): string | null {
  if (entry.description) {
    return entry.description
  }
  switch (completionKind(entry)) {
    case 'folder':
      return translate('terminal.shellEditor.completion.directory', 'Directory')
    case 'file':
      return translate('terminal.shellEditor.completion.file', 'File')
    case 'command':
    case 'option':
    case 'other':
      return null
  }
}

export function ShellEditorCompletionMenu({
  menu,
  typed,
  left,
  theme,
  onAccept
}: {
  menu: CompletionMenu
  /** The word as typed, before any preview, for bolding what matched. */
  typed: string
  /** Lines the menu up under the word being completed, as Warp does. */
  left: number
  theme: ITheme
  onAccept: (entry: ShellCompletion) => void
}): React.JSX.Element {
  const listRef = useRef<HTMLDivElement>(null)
  const foreground = theme.foreground ?? 'currentColor'
  const muted = `color-mix(in srgb, ${foreground} 60%, transparent)`
  const outline = `color-mix(in srgb, ${foreground} 14%, transparent)`
  const surface = `color-mix(in srgb, ${foreground} 6%, ${theme.background ?? 'Canvas'})`
  const accent = theme.blue ?? '#3b82f6'
  const picked = menu.visible[menu.selected]
  const typedTail = typed.slice(typed.lastIndexOf('/', typed.length - 2) + 1)

  useLayoutEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [menu.selected, menu.visible])

  return (
    <div
      className="shell-editor-completion"
      data-shell-editor-completion=""
      style={{ left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div
        ref={listRef}
        role="listbox"
        className="shell-editor-completion-list"
        style={{ background: surface, borderColor: outline, color: foreground }}
      >
        {menu.visible.map((entry, index) => {
          const selected = index === menu.selected
          const label = completionLabel(entry.value)
          const matched = label.startsWith(typedTail) ? typedTail.length : 0
          const Icon = KIND_ICONS[completionKind(entry)]
          const description = describe(entry)
          return (
            <div
              key={entry.value}
              role="option"
              aria-selected={selected}
              data-completion-value={entry.value}
              {...(selected ? { 'data-selected': '' } : {})}
              className="shell-editor-completion-item"
              style={selected ? { background: accent, color: theme.background } : undefined}
              onClick={() => onAccept(entry)}
            >
              <span
                className="shell-editor-completion-icon"
                style={selected ? undefined : { color: muted, borderColor: outline }}
              >
                <Icon aria-hidden="true" />
              </span>
              <span>
                <strong>{label.slice(0, matched)}</strong>
                {label.slice(matched)}
              </span>
              {description ? (
                <span
                  className="shell-editor-completion-description"
                  style={selected ? undefined : { color: muted }}
                >
                  {description}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {picked ? (
        <div
          className="shell-editor-completion-detail"
          style={{ background: surface, borderColor: outline, color: foreground }}
        >
          <strong>{picked.value}</strong>
          <span style={{ color: muted }}>{describe(picked)}</span>
        </div>
      ) : null}
    </div>
  )
}
