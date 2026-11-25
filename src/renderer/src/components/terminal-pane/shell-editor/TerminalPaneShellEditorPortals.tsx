import { createPortal } from 'react-dom'
import type { TerminalPaneController } from '../use-terminal-pane-controller'
import { getShellEditorSession } from './shell-editor-registry'
import { ShellEditorBox } from './ShellEditorBox'

export function TerminalPaneShellEditorPortals({
  controller
}: {
  controller: TerminalPaneController
}): React.JSX.Element {
  const { activePane, isActive, isVisible, managedPanes, paneTransportsRef } = controller
  return (
    <>
      {managedPanes.map((pane) => {
        const session = getShellEditorSession(pane.terminal)
        if (!session) {
          return null
        }
        return createPortal(
          <ShellEditorBox
            session={session}
            terminal={pane.terminal}
            paneContainer={pane.container}
            transport={paneTransportsRef.current.get(pane.id)}
            isFocusTarget={isActive && isVisible && activePane?.id === pane.id}
          />,
          pane.container,
          `shell-editor-${pane.id}`
        )
      })}
    </>
  )
}
