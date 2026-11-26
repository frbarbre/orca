import { useLayoutEffect, useRef } from 'react'
import type { ITheme } from '@xterm/xterm'
import type { CompletionMenu, ShellCompletion } from './shell-editor-completion'

export function ShellEditorCompletionMenu({
  menu,
  typed,
  theme,
  onAccept
}: {
  menu: CompletionMenu
  typed: string
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

  useLayoutEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [menu.selected, menu.visible])

  return (
    <div
      className="shell-editor-completion"
      data-shell-editor-completion=""
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
          const matched = entry.value.startsWith(typed) ? typed.length : 0
          return (
            <div
              key={entry.value}
              role="option"
              aria-selected={selected}
              {...(selected ? { 'data-selected': '' } : {})}
              className="shell-editor-completion-item"
              style={selected ? { background: accent, color: theme.background } : undefined}
              onClick={() => onAccept(entry)}
            >
              <span>
                <strong>{entry.value.slice(0, matched)}</strong>
                {entry.value.slice(matched)}
              </span>
              {entry.description ? (
                <span
                  className="shell-editor-completion-description"
                  style={selected ? undefined : { color: muted }}
                >
                  {entry.description}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      {picked?.description ? (
        <div
          className="shell-editor-completion-detail"
          style={{ background: surface, borderColor: outline, color: foreground }}
        >
          <strong>{picked.value}</strong>
          <span style={{ color: muted }}>{picked.description}</span>
        </div>
      ) : null}
    </div>
  )
}
