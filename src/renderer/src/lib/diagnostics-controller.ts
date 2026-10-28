import type {
  DiagnosticSource,
  EditorDiagnostic,
  EditorDiagnosticsEvent
} from '../../../shared/editor-diagnostics'

export type DiagnosedFile = {
  filePath: string
  worktreeRoot: string
  repoRoot: string | null
  venvSetting: string | null
}

export type DiagnosedModel = DiagnosedFile & {
  key: string
  getText: () => string
  setMarkers: (source: DiagnosticSource, diagnostics: EditorDiagnostic[]) => void
}

type Entry = {
  model: DiagnosedModel
  timer: ReturnType<typeof setTimeout> | null
  sources: Set<DiagnosticSource>
  /** What each source last showed, so the same findings again repaint nothing. */
  shown: Map<DiagnosticSource, string>
}

// Fork: checks only what an editor shows, and only once typing pauses, so a keystroke costs nothing.
export function createDiagnosticsController({
  sources,
  sync,
  close,
  pauseMs
}: {
  sources: (filePath: string) => readonly DiagnosticSource[]
  sync: (source: DiagnosticSource, file: DiagnosedFile & { text: string }) => Promise<unknown>
  close: (source: DiagnosticSource, filePath: string) => void
  pauseMs: number
}): {
  attach: (model: DiagnosedModel) => void
  changed: (key: string) => void
  detach: (key: string) => void
  diagnostics: (event: EditorDiagnosticsEvent) => void
  settingsChanged: (sources: readonly DiagnosticSource[]) => void
} {
  const entries = new Map<string, Entry>()

  const check = (entry: Entry): void => {
    entry.timer = null
    const enabled = sources(entry.model.filePath)
    if (enabled.length === 0) {
      return
    }
    const { filePath, worktreeRoot, repoRoot, venvSetting } = entry.model
    const text = entry.model.getText()
    for (const source of enabled) {
      entry.sources.add(source)
      void sync(source, { filePath, worktreeRoot, repoRoot, venvSetting, text })
    }
  }

  const forget = (entry: Entry, source: DiagnosticSource): void => {
    entry.sources.delete(source)
    entry.shown.delete(source)
    entry.model.setMarkers(source, [])
  }

  return {
    attach: (model) => {
      if (entries.has(model.key)) {
        return
      }
      const entry: Entry = { model, timer: null, sources: new Set(), shown: new Map() }
      entries.set(model.key, entry)
      check(entry)
    },
    changed: (key) => {
      const entry = entries.get(key)
      if (!entry) {
        return
      }
      if (entry.timer) {
        clearTimeout(entry.timer)
      }
      entry.timer = setTimeout(() => check(entry), pauseMs)
    },
    detach: (key) => {
      const entry = entries.get(key)
      if (!entry) {
        return
      }
      if (entry.timer) {
        clearTimeout(entry.timer)
      }
      for (const source of entry.sources) {
        close(source, entry.model.filePath)
        forget(entry, source)
      }
      entries.delete(key)
    },
    diagnostics: ({ source, filePath, diagnostics }) => {
      const fingerprint = JSON.stringify(diagnostics)
      for (const entry of entries.values()) {
        if (
          entry.model.filePath === filePath &&
          entry.sources.has(source) &&
          entry.shown.get(source) !== fingerprint
        ) {
          entry.shown.set(source, fingerprint)
          entry.model.setMarkers(source, diagnostics)
        }
      }
    },
    settingsChanged: (changed) => {
      for (const entry of entries.values()) {
        for (const source of changed) {
          if (entry.sources.has(source)) {
            forget(entry, source)
          }
        }
        check(entry)
      }
    }
  }
}
