import { useMemo } from 'react'
import type { DiffComment } from '../../../shared/diff-comment-types'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import { getIndexedWorktreeById } from '@/store/worktree-repo-index'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import { getSettingsForWorktreeRuntimeOwner } from '@/lib/worktree-runtime-owner'
import { requestPRCommentReveal } from '@/lib/pr-comment-reveal'
import { selectWorktreeDiffComments } from '@/store/worktree-diff-comments-selector'

const NO_AGENT_NOTES: readonly DiffComment[] = Object.freeze([])

export function selectWorktreeAgentNotes(
  state: Pick<AppState, 'worktreesByRepo'>,
  worktreeId: string | null | undefined
): readonly DiffComment[] {
  if (!worktreeId) {
    return NO_AGENT_NOTES
  }
  return getIndexedWorktreeById(state.worktreesByRepo, worktreeId)?.agentNotes ?? NO_AGENT_NOTES
}

export function useWorktreeAgentNotes(
  worktreeId: string | null | undefined
): readonly DiffComment[] {
  return useAppStore((state) => selectWorktreeAgentNotes(state, worktreeId))
}

export function useFileAgentNotes(
  worktreeId: string | null | undefined,
  filePath: string
): readonly DiffComment[] {
  const notes = useWorktreeAgentNotes(worktreeId)
  return useMemo(() => notes.filter((note) => note.filePath === filePath), [notes, filePath])
}

export function isAgentNoteId(notes: readonly DiffComment[], id: string): boolean {
  return notes.some((note) => note.id === id)
}

/** For a follow-up note: its thread's root and the replies before it, oldest first. */
export function earlierInThreadFromStore(
  worktreeId: string
): (note: DiffComment) => readonly DiffComment[] {
  const state = useAppStore.getState()
  const all = [
    ...(selectWorktreeDiffComments(state, worktreeId) ?? []),
    ...selectWorktreeAgentNotes(state, worktreeId)
  ]
  return (note) => {
    const root = all.find((candidate) => candidate.id === note.replyToNoteId)
    if (!root) {
      return []
    }
    const earlier = all
      .filter(
        (candidate) => candidate.replyToNoteId === root.id && candidate.createdAt < note.createdAt
      )
      .sort((a, b) => a.createdAt - b.createdAt)
    return [root, ...earlier]
  }
}

export function revealGitHubComment(url: string): void {
  const state = useAppStore.getState()
  state.setRightSidebarOpen(true)
  state.setRightSidebarTab('checks')
  requestPRCommentReveal(url)
}

export async function removeAgentNote(worktreeId: string, id: string): Promise<void> {
  const state = useAppStore.getState()
  const target = getActiveRuntimeTarget(getSettingsForWorktreeRuntimeOwner(state, worktreeId))
  await callRuntimeRpc(
    target,
    'agentNote.remove',
    { worktree: toRuntimeWorktreeSelector(worktreeId), id },
    { timeoutMs: 15_000 }
  )
}
