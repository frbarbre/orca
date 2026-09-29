import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { getShortcutPlatform } from '@/hooks/useShortcutLabel'
import { keybindingMatchesAction } from '../../../../shared/keybindings'

export function useRunQuickCommandShortcut({
  worktreeId,
  groupId,
  onRun
}: {
  worktreeId: string
  groupId: string
  onRun: (() => void) | null
}): void {
  useEffect(() => {
    if (!onRun) {
      return
    }
    const listener = (event: KeyboardEvent): void => {
      if (event.repeat || event.defaultPrevented) {
        return
      }
      const state = useAppStore.getState()
      // Why: every tab group renders its own Run button; only the focused group's may answer.
      if (
        state.activeWorktreeId !== worktreeId ||
        state.activeGroupIdByWorktree[worktreeId] !== groupId
      ) {
        return
      }
      if (
        !keybindingMatchesAction(
          'tab.runQuickCommand',
          event,
          getShortcutPlatform(),
          state.keybindings
        )
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onRun()
    }
    window.addEventListener('keydown', listener, true)
    return () => window.removeEventListener('keydown', listener, true)
  }, [groupId, onRun, worktreeId])
}
