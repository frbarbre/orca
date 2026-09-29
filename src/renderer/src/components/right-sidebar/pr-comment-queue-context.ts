import { useCallback, useSyncExternalStore } from 'react'
import { isPRCommentGroupQueueableForAI } from '@/lib/pr-comment-action-state'
import { getPRCommentGroupId, type PRCommentGroup } from '../../../../shared/pr-comment-groups'
import {
  readPRCommentsListSelectedGroupIds,
  setPRCommentsListGroupQueued,
  subscribePRCommentsListSelection
} from './pr-comments-list-selection'

const contextKeyByWorktree = new Map<string, string>()
const contextListeners = new Set<() => void>()

// Why published by the panel: its queue key folds in the pull request head and cache key, which an inline card cannot rebuild.
export function publishPRCommentQueueContext(worktreeId: string, contextKey: string): void {
  if (!contextKey || contextKeyByWorktree.get(worktreeId) === contextKey) {
    return
  }
  contextKeyByWorktree.set(worktreeId, contextKey)
  for (const listener of contextListeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  contextListeners.add(listener)
  const unsubscribeSelection = subscribePRCommentsListSelection(listener)
  return () => {
    contextListeners.delete(listener)
    unsubscribeSelection()
  }
}

export function usePRCommentQueueToggle(
  worktreeId: string,
  group: PRCommentGroup
): { queued: boolean; toggle: () => void } | null {
  const groupId = getPRCommentGroupId(group)
  const read = (): string => {
    const contextKey = contextKeyByWorktree.get(worktreeId) ?? ''
    const queued = contextKey ? readPRCommentsListSelectedGroupIds(contextKey).has(groupId) : false
    return `${contextKey}\u0000${queued ? '1' : '0'}`
  }
  const snapshot = useSyncExternalStore(subscribe, read, read)
  const [contextKey, flag] = snapshot.split('\u0000')
  const queued = flag === '1'
  const toggle = useCallback(() => {
    if (contextKey) {
      setPRCommentsListGroupQueued(contextKey, groupId, !queued)
    }
  }, [contextKey, groupId, queued])
  if (!contextKey || !isPRCommentGroupQueueableForAI(group)) {
    return null
  }
  return { queued, toggle }
}
