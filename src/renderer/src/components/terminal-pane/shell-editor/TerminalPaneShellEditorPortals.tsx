import { createPortal } from 'react-dom'
import { makePaneKey } from '../../../../../shared/stable-pane-id'
import type { TerminalPaneController } from '../use-terminal-pane-controller'
import { getShellEditorSession } from './shell-editor-registry'
import { ShellEditorBox } from './ShellEditorBox'

export function TerminalPaneShellEditorPortals({
  controller
}: {
  controller: TerminalPaneController
}): React.JSX.Element {
  const { activePane, isActive, isVisible, managedPanes, paneTransportsRef, tabId } = controller
  return (
    <>
      {managedPanes.map((pane) =>
        createPortal(
          <ShellEditorBox
            session={getShellEditorSession(makePaneKey(tabId, pane.leafId))}
            terminal={pane.terminal}
            paneContainer={pane.container}
            transport={paneTransportsRef.current.get(pane.id)}
            isShown={isActive && isVisible}
            isFocusTarget={isActive && isVisible && activePane?.id === pane.id}
          />,
          pane.container,
          `shell-editor-${pane.id}`
        )
      )}
    </>
  )
}
