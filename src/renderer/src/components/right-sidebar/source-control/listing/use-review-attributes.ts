import { useEffect, useMemo, useState } from 'react'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import {
  GIT_CHECK_ATTR_MAX_PATHS,
  type GitPathReviewAttributes
} from '../../../../../../shared/git-review-attributes'
import { getConnectionId } from '@/lib/connection-context'
import { getRuntimeGitReviewAttributes } from '@/runtime/runtime-git-status-client'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { setSourceControlReviewAttributes } from './file-scope-store'
import { useAppStore } from '@/store'
import { importOnlyCandidates, withImportOnlyAttributes } from './import-only-attributes'
import { selectBranchLineCounts } from './scoped-change-entries'

const NO_ATTRIBUTES: GitPathReviewAttributes = Object.freeze({})

function isGitAttributesPath(path: string): boolean {
  return path === '.gitattributes' || path.endsWith('/.gitattributes')
}

/** Reads the `.gitattributes` review categories for every changed path, staged to committed. */
export function useSourceControlReviewAttributes({
  activeWorktreeId,
  worktreePath,
  activeRepoTarget,
  isFolder,
  entries,
  branchEntries
}: {
  activeWorktreeId: string | null
  worktreePath: string | null
  activeRepoTarget: RuntimeClientTarget | null
  isFolder: boolean
  entries: readonly GitStatusEntry[]
  branchEntries: readonly GitBranchChangeEntry[]
}): GitPathReviewAttributes {
  const paths = useMemo(() => {
    const unique = new Set<string>()
    for (const entry of entries) {
      unique.add(entry.path)
    }
    for (const entry of branchEntries) {
      unique.add(entry.path)
    }
    return Array.from(unique).sort().slice(0, GIT_CHECK_ATTR_MAX_PATHS)
  }, [branchEntries, entries])
  const pathsKey = paths.join('\0')
  // Why: editing .gitattributes changes no path, so only then does every status refresh re-read the rules.
  const gitAttributesRefreshToken = paths.some(isGitAttributesPath) ? entries : null
  const scope = `${activeWorktreeId ?? ''}\0${worktreePath ?? ''}`
  const enabled = Boolean(worktreePath && activeRepoTarget) && !isFolder && paths.length > 0
  const [store, setStore] = useState<{ scope: string; attributes: GitPathReviewAttributes }>({
    scope,
    attributes: NO_ATTRIBUTES
  })

  useEffect(() => {
    if (!enabled || !worktreePath || !activeRepoTarget) {
      return
    }
    let cancelled = false
    const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
    getRuntimeGitReviewAttributes(
      { target: activeRepoTarget, worktreeId: activeWorktreeId, worktreePath, connectionId },
      pathsKey.split('\0')
    )
      .catch(() => NO_ATTRIBUTES)
      .then((attributes) => {
        if (!cancelled) {
          setStore({ scope, attributes })
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    activeRepoTarget,
    activeWorktreeId,
    enabled,
    gitAttributesRefreshToken,
    pathsKey,
    scope,
    worktreePath
  ])

  // Why keep the last answer while a refetch runs: rules rarely change between polls, and rows would flicker between categories.
  const checked = enabled && store.scope === scope ? store.attributes : NO_ATTRIBUTES
  const importOnlyPaths = useImportOnlyPaths({ activeWorktreeId, worktreePath, isFolder, scope })
  const attributes = useMemo(
    () => withImportOnlyAttributes(checked, importOnlyPaths),
    [checked, importOnlyPaths]
  )
  useEffect(() => {
    if (activeWorktreeId) {
      setSourceControlReviewAttributes(activeWorktreeId, attributes)
    }
  }, [activeWorktreeId, attributes])
  return attributes
}

const NO_PATHS: string[] = []

// Fork: which small changes touch only imports, asked again whenever a file's line counts move.
function useImportOnlyPaths({
  activeWorktreeId,
  worktreePath,
  isFolder,
  scope
}: {
  activeWorktreeId: string | null
  worktreePath: string | null
  isFolder: boolean
  scope: string
}): string[] {
  const lineCounts = useAppStore((state) => selectBranchLineCounts(state, activeWorktreeId))
  const mergeBase = useAppStore((state) =>
    activeWorktreeId ? state.gitBranchCompareSummaryByWorktree[activeWorktreeId]?.mergeBase : null
  )
  const candidates = useMemo(() => importOnlyCandidates(lineCounts), [lineCounts])
  // Why a key: the counts object is rebuilt on every status poll even when no count moved.
  const countsKey =
    candidates.length > 0
      ? JSON.stringify(
          candidates.map((path) => [
            path,
            lineCounts?.[path]?.added ?? 0,
            lineCounts?.[path]?.removed ?? 0
          ])
        )
      : ''
  const [found, setFound] = useState<{ scope: string; paths: string[] }>({ scope, paths: NO_PATHS })
  useEffect(() => {
    if (!worktreePath || !mergeBase || isFolder || !countsKey) {
      return
    }
    let cancelled = false
    const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
    window.api.git
      .importOnlyPaths({
        worktreePath,
        mergeBase,
        paths: (JSON.parse(countsKey) as [string, number, number][]).map(([path]) => path),
        connectionId
      })
      .catch(() => NO_PATHS)
      .then((paths) => {
        if (!cancelled) {
          setFound({ scope, paths })
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeWorktreeId, countsKey, isFolder, mergeBase, scope, worktreePath])
  return found.scope === scope && countsKey ? found.paths : NO_PATHS
}
