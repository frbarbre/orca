import type {
  LintDiagnostic,
  LintDiagnosticsEvent,
  LintRequest,
  LinterId
} from '../../../shared/linter'

export type LintedModel = {
  key: string
  filePath: string
  worktreeRoot: string
  repoRoot: string | null
  getText: () => string
  setMarkers: (linter: LinterId, diagnostics: LintDiagnostic[]) => void
}

type Entry = {
  model: LintedModel
  timer: ReturnType<typeof setTimeout> | null
  linters: Set<LinterId>
}

// Fork: lints only what an editor shows, and only once typing pauses, so a keystroke costs nothing.
export function createLintDiagnosticsController({
  sync,
  close,
  enabledLinters,
  pauseMs
}: {
  sync: (request: LintRequest) => Promise<unknown>
  close: (args: { linter: LinterId; filePath: string }) => void
  enabledLinters: (filePath: string) => { linter: LinterId; command: string | null }[]
  pauseMs: number
}): {
  attach: (model: LintedModel) => void
  changed: (key: string) => void
  detach: (key: string) => void
  diagnostics: (event: LintDiagnosticsEvent) => void
  settingsChanged: (linters: readonly LinterId[]) => void
} {
  const entries = new Map<string, Entry>()

  const lint = (entry: Entry): void => {
    entry.timer = null
    const enabled = enabledLinters(entry.model.filePath)
    if (enabled.length === 0) {
      return
    }
    const { filePath, worktreeRoot, repoRoot } = entry.model
    const text = entry.model.getText()
    for (const { linter, command } of enabled) {
      entry.linters.add(linter)
      void sync({ linter, command, filePath, worktreeRoot, repoRoot, text })
    }
  }

  const forget = (entry: Entry, linter: LinterId): void => {
    entry.linters.delete(linter)
    entry.model.setMarkers(linter, [])
  }

  return {
    attach: (model) => {
      if (entries.has(model.key)) {
        return
      }
      const entry: Entry = { model, timer: null, linters: new Set() }
      entries.set(model.key, entry)
      lint(entry)
    },
    changed: (key) => {
      const entry = entries.get(key)
      if (!entry) {
        return
      }
      if (entry.timer) {
        clearTimeout(entry.timer)
      }
      entry.timer = setTimeout(() => lint(entry), pauseMs)
    },
    detach: (key) => {
      const entry = entries.get(key)
      if (!entry) {
        return
      }
      if (entry.timer) {
        clearTimeout(entry.timer)
      }
      for (const linter of entry.linters) {
        close({ linter, filePath: entry.model.filePath })
        forget(entry, linter)
      }
      entries.delete(key)
    },
    diagnostics: ({ linter, filePath, diagnostics }) => {
      for (const entry of entries.values()) {
        if (entry.model.filePath === filePath && entry.linters.has(linter)) {
          entry.model.setMarkers(linter, diagnostics)
        }
      }
    },
    settingsChanged: (linters) => {
      for (const entry of entries.values()) {
        for (const linter of linters) {
          if (entry.linters.has(linter)) {
            forget(entry, linter)
          }
        }
        lint(entry)
      }
    }
  }
}
