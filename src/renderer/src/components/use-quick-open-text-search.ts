import { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { getConnectionId } from '@/lib/connection-context'
import { readIpcErrorDetail } from '@/lib/ipc-error'
import { getRuntimeEnvironmentIdForWorktree } from '@/lib/worktree-runtime-owner'
import { searchRuntimeFiles } from '@/runtime/runtime-file-client'
import type { SearchResult } from '../../../shared/code-search-types'

const TEXT_SEARCH_DEBOUNCE_MS = 150
const TEXT_SEARCH_MAX_RESULTS = 300

type TextSearchState = {
  key: string
  result: SearchResult | null
  error: string | null
  loading: boolean
}

export function useQuickOpenTextSearch(
  worktreeId: string | null,
  worktreePath: string | null,
  query: string | null
): { result: SearchResult | null; error: string | null; loading: boolean } {
  const runtimeEnvironmentId = useAppStore((state) =>
    getRuntimeEnvironmentIdForWorktree(state, worktreeId)
  )
  const key = `${worktreeId}\n${worktreePath}\n${query}`
  const [state, setState] = useState<TextSearchState>({
    key: '',
    result: null,
    error: null,
    loading: false
  })
  const active = Boolean(worktreeId && worktreePath && query?.trim())

  useEffect(() => {
    if (!worktreeId || !worktreePath || !query?.trim()) {
      return
    }
    const controller = new AbortController()
    setState((previous) => ({ ...previous, key, loading: true, error: null }))
    const timer = window.setTimeout(() => {
      searchRuntimeFiles(
        {
          settings: { activeRuntimeEnvironmentId: runtimeEnvironmentId },
          worktreeId,
          worktreePath,
          connectionId: getConnectionId(worktreeId) ?? undefined
        },
        { query, rootPath: worktreePath, maxResults: TEXT_SEARCH_MAX_RESULTS },
        controller.signal
      )
        .then((result) => {
          if (!controller.signal.aborted) {
            setState({ key, result, error: null, loading: false })
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setState({
              key,
              result: null,
              error: readIpcErrorDetail(error) ?? String(error),
              loading: false
            })
          }
        })
    }, TEXT_SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [key, query, runtimeEnvironmentId, worktreeId, worktreePath])

  if (!active) {
    return { result: null, error: null, loading: false }
  }
  // Why keep the last result while typing: the list would otherwise blink empty on every key.
  return {
    result: state.result,
    error: state.key === key ? state.error : null,
    loading: state.key !== key || state.loading
  }
}
