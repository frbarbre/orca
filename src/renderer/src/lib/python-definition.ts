import type { PythonDefinitionLocation } from '../../../shared/python-definition'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'

type DefinitionState = {
  openFiles: readonly { filePath: string; worktreeId: string }[]
  worktreesByRepo: Record<string, readonly { id: string; path: string; repoId: string }[]>
  repos: readonly {
    id: string
    connectionId?: string | null
    executionHostId?: string | null
    pythonVenvPath?: string
  }[]
}

function findWorktree(state: DefinitionState, worktreeId: string) {
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    const match = worktrees.find((worktree) => worktree.id === worktreeId)
    if (match) {
      return match
    }
  }
  return undefined
}

function localWorktreeOf(state: DefinitionState, filePath: string) {
  const file = state.openFiles.find((candidate) => candidate.filePath === filePath)
  const worktree = file ? findWorktree(state, file.worktreeId) : undefined
  const repo = worktree ? state.repos.find((candidate) => candidate.id === worktree.repoId) : null
  // Why local only: the language server runs on this machine and reads the checkout from disk.
  if (!worktree || !repo || getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
    return null
  }
  return { worktree, repo }
}

export function pythonDefinitionContext(
  state: DefinitionState,
  filePath: string
): { worktreeId: string; worktreeRoot: string; venvSetting: string | null } | null {
  const local = localWorktreeOf(state, filePath)
  return local
    ? {
        worktreeId: local.worktree.id,
        worktreeRoot: local.worktree.path,
        venvSetting: local.repo.pythonVenvPath ?? null
      }
    : null
}

export function definitionOpenTarget(
  state: DefinitionState,
  sourceFilePath: string,
  targetFilePath: string
): { worktreeId: string; filePath: string; relativePath: string } | null {
  const local = localWorktreeOf(state, sourceFilePath)
  if (!local) {
    return null
  }
  const root = local.worktree.path.replace(/\/+$/, '')
  const inside = targetFilePath.startsWith(`${root}/`)
  return {
    worktreeId: local.worktree.id,
    filePath: targetFilePath,
    // Orca's convention for a file outside the worktree is a relative path equal to the absolute one.
    relativePath: inside ? targetFilePath.slice(root.length + 1) : targetFilePath
  }
}

export function toEditorPosition(location: PythonDefinitionLocation): {
  lineNumber: number
  column: number
} {
  return { lineNumber: location.line + 1, column: location.character + 1 }
}
