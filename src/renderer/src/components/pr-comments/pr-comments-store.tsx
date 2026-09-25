import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { PRComment } from '../../../../shared/github/comment-types'

/**
 * The PR comment working copy, held above the panel that used to own it.
 *
 * Why it moved: the Checks panel is mounted only while its tab is selected
 * (right-sidebar-panel-content.tsx), so the comments and every optimistic edit made to them died on
 * a tab switch. The diff viewer renders the same comment cards inline and must keep working when
 * that tab is not the one on screen.
 *
 * Why a working copy at all, when the fetch is already cached in the store: mutations apply
 * optimistically here (reply, edit, resolve, react) before the refetch lands.
 *
 * Why keyed by PR rather than one list: two worktrees have different PRs, and a single list would
 * show one worktree's review on another's diff.
 */
export type PRCommentsState = {
  comments: PRComment[]
  setComments: React.Dispatch<React.SetStateAction<PRComment[]>>
  commentsRef: React.MutableRefObject<PRComment[]>
  commentsLoading: boolean
  setCommentsLoading: React.Dispatch<React.SetStateAction<boolean>>
}

type PRCommentsRegistry = {
  read: (key: string) => PRComment[]
  write: (key: string, update: React.SetStateAction<PRComment[]>) => void
  loading: Record<string, boolean>
  setLoading: (key: string, value: React.SetStateAction<boolean>) => void
}

const PRCommentsContext = createContext<PRCommentsRegistry | null>(null)

const NO_COMMENTS: PRComment[] = []

export function PRCommentsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [byKey, setByKey] = useState<Record<string, PRComment[]>>({})
  const [loading, setLoadingState] = useState<Record<string, boolean>>({})
  // Why a ref beside the state: mutation handlers read the latest list inside async callbacks that
  // closed over an older render.
  const byKeyRef = useRef<Record<string, PRComment[]>>({})
  byKeyRef.current = byKey

  const read = useCallback((key: string) => byKeyRef.current[key] ?? NO_COMMENTS, [])

  const write = useCallback((key: string, update: React.SetStateAction<PRComment[]>) => {
    setByKey((current) => {
      const previous = current[key] ?? NO_COMMENTS
      const next = typeof update === 'function' ? update(previous) : update
      if (next === previous) {
        return current
      }
      return { ...current, [key]: next }
    })
  }, [])

  const setLoading = useCallback((key: string, value: React.SetStateAction<boolean>) => {
    setLoadingState((current) => {
      const previous = current[key] ?? false
      const next = typeof value === 'function' ? value(previous) : value
      if (next === previous) {
        return current
      }
      return { ...current, [key]: next }
    })
  }, [])

  const value = useMemo<PRCommentsRegistry>(
    () => ({ read, write, loading, setLoading }),
    [loading, read, setLoading, write]
  )
  return <PRCommentsContext.Provider value={value}>{children}</PRCommentsContext.Provider>
}

function useLocalPRCommentsState(): PRCommentsState {
  const [comments, setComments] = useState<PRComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const commentsRef = useRef<PRComment[]>([])
  commentsRef.current = comments
  return { comments, setComments, commentsRef, commentsLoading, setCommentsLoading }
}

/**
 * The comment list for one PR.
 *
 * Why the local fallback: the panel and its tests render without a provider, and a hook cannot be
 * called conditionally — so both are built every render and the provider wins when present.
 */
export function usePRCommentsState(prCacheKey: string): PRCommentsState {
  const registry = useContext(PRCommentsContext)
  const local = useLocalPRCommentsState()
  const comments = registry && prCacheKey ? registry.read(prCacheKey) : local.comments
  const commentsRef = useRef<PRComment[]>(comments)
  commentsRef.current = comments

  const setComments = useCallback<React.Dispatch<React.SetStateAction<PRComment[]>>>(
    (update) => {
      if (registry && prCacheKey) {
        registry.write(prCacheKey, update)
        return
      }
      local.setComments(update)
    },
    [local, prCacheKey, registry]
  )

  const setCommentsLoading = useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      if (registry && prCacheKey) {
        registry.setLoading(prCacheKey, value)
        return
      }
      local.setCommentsLoading(value)
    },
    [local, prCacheKey, registry]
  )

  if (!registry || !prCacheKey) {
    return local
  }
  return {
    comments,
    setComments,
    commentsRef,
    commentsLoading: registry.loading[prCacheKey] ?? false,
    setCommentsLoading
  }
}
