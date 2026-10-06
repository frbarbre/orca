import { useEffect, useMemo, useState } from 'react'
import type { GitBranchChangeEntry } from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import {
  GIT_CHECK_ATTR_MAX_PATHS,
  type GitPathReviewAttributes
} from '../../../../../../shared/git-review-attributes'
import { getConnectionId } from '@/lib/connection-context'
import { getRuntimeGitReviewAttributes, type RuntimeGitContext } from '@/runtime/runtime-git-client'

const NO_ATTRIBUTES: GitPathReviewAttributes = Object.freeze({})

function isGitAttributesPath(path: string): boolean {
  return path === '.gitattributes' || path.endsWith('/.gitattributes')
}

/** Reads the `.gitattributes` review categories for every changed path, staged to committed. */
export function useSourceControlReviewAttributes({
  activeWorktreeId,
  worktreePath,
  activeRepoSettings,
  isFolder,
  entries,
  branchEntries
}: {
  activeWorktreeId: string | null
  worktreePath: string | null
  activeRepoSettings: RuntimeGitContext['settings']
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
  const enabled = Boolean(worktreePath) && !isFolder && paths.length > 0
  const [store, setStore] = useState<{ scope: string; attributes: GitPathReviewAttributes }>({
    scope,
    attributes: NO_ATTRIBUTES
  })

  useEffect(() => {
    if (!enabled || !worktreePath) {
      return
    }
    let cancelled = false
    const connectionId = getConnectionId(activeWorktreeId ?? null) ?? undefined
    getRuntimeGitReviewAttributes(
      { settings: activeRepoSettings, worktreeId: activeWorktreeId, worktreePath, connectionId },
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
    activeRepoSettings,
    activeWorktreeId,
    enabled,
    gitAttributesRefreshToken,
    pathsKey,
    scope,
    worktreePath
  ])

  // Why keep the last answer while a refetch runs: rules rarely change between polls, and rows would flicker between categories.
  return enabled && store.scope === scope ? store.attributes : NO_ATTRIBUTES
}
