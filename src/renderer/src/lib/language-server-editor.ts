import type {
  LanguageServerLanguage,
  LanguageServerLocation
} from '../../../shared/language-server'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'

const SERVER_LANGUAGE_BY_MONACO_ID: Record<string, LanguageServerLanguage> = {
  python: 'python',
  typescript: 'typescript',
  javascript: 'typescript'
}

export function serverLanguageFor(monacoLanguageId: string): LanguageServerLanguage | null {
  return SERVER_LANGUAGE_BY_MONACO_ID[monacoLanguageId] ?? null
}

// Why `!== false`: the setting is stored shallowly, so an unset language means on.
export function languageServerEnabled(
  settings: { languageServers?: Partial<Record<LanguageServerLanguage, boolean>> } | null,
  language: LanguageServerLanguage
): boolean {
  return settings?.languageServers?.[language] !== false
}

type DefinitionState = {
  openFiles: readonly { filePath: string; worktreeId: string }[]
  worktreesByRepo: Record<string, readonly { id: string; path: string; repoId: string }[]>
  repos: readonly {
    id: string
    path: string
    connectionId?: string | null
    executionHostId?: string | null
    pythonVenvPath?: string | null
  }[]
}

type DefinitionContext = {
  worktreeId: string
  worktreeRoot: string
  repoRoot: string
  venvSetting: string | null
}

function localWorktree(state: DefinitionState, worktreeId: string): DefinitionContext | null {
  for (const worktrees of Object.values(state.worktreesByRepo)) {
    const worktree = worktrees.find((candidate) => candidate.id === worktreeId)
    if (!worktree) {
      continue
    }
    const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
    // Why local only: the language server runs on this machine and reads the checkout from disk.
    if (!repo || getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
      return null
    }
    return {
      worktreeId,
      worktreeRoot: worktree.path.replace(/\/+$/, ''),
      repoRoot: repo.path.replace(/\/+$/, ''),
      venvSetting: repo.pythonVenvPath ?? null
    }
  }
  return null
}

export function openFileContext(
  state: DefinitionState,
  filePath: string
): DefinitionContext | null {
  const file = state.openFiles.find((candidate) => candidate.filePath === filePath)
  return file ? localWorktree(state, file.worktreeId) : null
}

export function trackedFileContext(
  state: DefinitionState,
  file: { worktreeId: string; relativePath: string }
): (DefinitionContext & { filePath: string }) | null {
  const context = localWorktree(state, file.worktreeId)
  return context ? { filePath: `${context.worktreeRoot}/${file.relativePath}`, ...context } : null
}

export function definitionOpenTarget(
  state: DefinitionState,
  worktreeId: string,
  targetFilePath: string
): { worktreeId: string; filePath: string; relativePath: string } | null {
  const context = localWorktree(state, worktreeId)
  if (!context) {
    return null
  }
  const inside = targetFilePath.startsWith(`${context.worktreeRoot}/`)
  return {
    worktreeId,
    filePath: targetFilePath,
    // Orca's convention for a file outside the worktree is a relative path equal to the absolute one.
    relativePath: inside ? targetFilePath.slice(context.worktreeRoot.length + 1) : targetFilePath
  }
}

type ChangeState = {
  gitStatusByWorktree: Record<string, readonly { path: string }[] | undefined>
  gitBranchChangesByWorktree: Record<string, readonly { path: string }[] | undefined>
  gitBranchCompareSummaryByWorktree: Record<string, { status: string } | null | undefined>
}

// Why the ready gate: openDiffAtLocation falls back to a changes-mode tab when it finds no diff.
export function targetHasDiff(
  state: ChangeState,
  worktreeId: string,
  relativePath: string
): boolean {
  const isPath = (entry: { path: string }): boolean => entry.path === relativePath
  if ((state.gitStatusByWorktree[worktreeId] ?? []).some(isPath)) {
    return true
  }
  return (
    state.gitBranchCompareSummaryByWorktree[worktreeId]?.status === 'ready' &&
    (state.gitBranchChangesByWorktree[worktreeId] ?? []).some(isPath)
  )
}

type TabState = {
  activeFileId: string | null
  openFiles: readonly {
    id: string
    filePath: string
    worktreeId: string
    mode: string
    isDirty: boolean
  }[]
  editorDrafts: Record<string, unknown>
}

export function replaceableTabId(
  state: TabState,
  source: { worktreeId: string; filePath: string; inDiff: boolean },
  targetFilePath: string
): string | null {
  const active = state.openFiles.find((file) => file.id === state.activeFileId)
  const targetHasTab = state.openFiles.some(
    (file) => file.worktreeId === source.worktreeId && file.filePath === targetFilePath
  )
  if (
    !active ||
    targetHasTab ||
    active.isDirty ||
    state.editorDrafts[active.id] !== undefined ||
    active.worktreeId !== source.worktreeId ||
    active.filePath !== source.filePath ||
    (active.mode === 'diff') !== source.inDiff
  ) {
    return null
  }
  return active.id
}

// Why blank lines first: Monaco previews a definition by its line number in this model.
export function previewModelText(location: LanguageServerLocation): string {
  return '\n'.repeat(location.line) + (location.preview ?? '')
}

export function toEditorPosition(location: LanguageServerLocation): {
  lineNumber: number
  column: number
} {
  return { lineNumber: location.line + 1, column: location.character + 1 }
}
