import { useLayoutEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { Terminal } from '@xterm/xterm'
import { makePaneKey } from '../../../../../shared/stable-pane-id'
import type { TerminalPaneController } from '../use-terminal-pane-controller'
import { getShellBlockTracker, getShellEditorSession } from './shell-editor-registry'
import type { ShellEditorSession } from './shell-editor-session'
import { ShellBlocksOverlay } from './ShellBlocksOverlay'
import { ShellEditorBox } from './ShellEditorBox'

function PaneShellBlocks({
  session,
  terminal,
  paneContainer
}: {
  session: ShellEditorSession
  terminal: Terminal
  paneContainer: HTMLElement
}): React.JSX.Element | null {
  const { phase } = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const tracker = getShellBlockTracker(terminal)
  const active = phase !== 'off'
  // Why on the pane: the CSS inset must hold steady while the box comes and goes.
  useLayoutEffect(() => {
    if (!active) {
      return
    }
    paneContainer.setAttribute('data-shell-editor', '')
    return () => paneContainer.removeAttribute('data-shell-editor')
  }, [paneContainer, active])
  if (!active || !tracker) {
    return null
  }
  return (
    <ShellBlocksOverlay
      terminal={terminal}
      tracker={tracker}
      atPrompt={phase === 'prompt' || phase === 'starting'}
    />
  )
}

export function TerminalPaneShellEditorPortals({
  controller
}: {
  controller: TerminalPaneController
}): React.JSX.Element {
  const { activePane, isActive, isVisible, managedPanes, paneTransportsRef, tabId } = controller
  return (
    <>
      {managedPanes.map((pane) => {
        const session = getShellEditorSession(makePaneKey(tabId, pane.leafId))
        const focused = managedPanes.length > 1 && activePane?.id === pane.id
        return createPortal(
          <>
            {focused ? (
              <span
                className="pane-focus-indicator"
                data-pane-focus-indicator=""
                aria-hidden="true"
                style={{ background: pane.terminal.options.theme?.blue ?? '#3b82f6' }}
              />
            ) : null}
            <PaneShellBlocks
              session={session}
              terminal={pane.terminal}
              paneContainer={pane.container}
            />
            <ShellEditorBox
              session={session}
              terminal={pane.terminal}
              paneContainer={pane.container}
              transport={paneTransportsRef.current.get(pane.id)}
              isShown={isActive && isVisible}
              isFocusTarget={isActive && isVisible && activePane?.id === pane.id}
            />
          </>,
          pane.container,
          `shell-editor-${pane.id}`
        )
      })}
    </>
  )
}
