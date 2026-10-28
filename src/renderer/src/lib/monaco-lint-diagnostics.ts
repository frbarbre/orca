import type * as Monaco from 'monaco-editor'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  LINTER_IDS,
  LINTERS,
  linterSettings,
  lintersForFile,
  type LinterId
} from '../../../shared/linter'
import { fileSource } from './language-server-file-source'
import { createLintDiagnosticsController } from './lint-diagnostics-controller'
import { toLintMarker } from './lint-markers'

const PAUSE_MS = 300

const reportedFailures = new Set<string>()

function reportLintFailure(linter: LinterId, error: string): void {
  const key = `${linter}:${error}`
  if (reportedFailures.has(key)) {
    return
  }
  reportedFailures.add(key)
  toast.error(
    translate(
      'linters.unavailable',
      '{{linter}} is unavailable ({{error}}). Install it in the project, or set its path or turn it off in Settings → Language Servers.',
      { linter: LINTERS[linter].name, error }
    )
  )
}

function settingsKey(linter: LinterId): string {
  return JSON.stringify(linterSettings(useAppStore.getState().settings, linter))
}

// Fork: squiggles from each linter in `shared/linter.ts`, for the files open in an editor tab.
export function installMonacoLintDiagnostics(monaco: typeof Monaco): void {
  const api = window.api?.lint
  if (!api) {
    return
  }
  const controller = createLintDiagnosticsController({
    sync: async (request) => {
      const result = await api.sync(request)
      if (!result.ok) {
        reportLintFailure(request.linter, result.error)
      }
    },
    close: (args) => void api.close(args),
    enabledLinters: (filePath) =>
      lintersForFile(filePath).flatMap((linter) => {
        const { enabled, command } = linterSettings(useAppStore.getState().settings, linter)
        return enabled ? [{ linter, command }] : []
      }),
    pauseMs: PAUSE_MS
  })
  api.onDiagnostics(controller.diagnostics)

  const shown = new Map<string, Monaco.IDisposable>()
  const refresh = (): void => {
    const models = new Map<string, Monaco.editor.ITextModel>()
    for (const editor of monaco.editor.getEditors()) {
      const model = editor.getModel()
      if (model && !model.isDisposed()) {
        models.set(model.uri.toString(), model)
      }
    }
    for (const [key, listener] of shown) {
      if (!models.has(key)) {
        listener.dispose()
        shown.delete(key)
        controller.detach(key)
      }
    }
    for (const [key, model] of models) {
      // Why only an editor tab's file: a diff side or Peek copy is not the text being edited.
      const source = model.uri.scheme === 'file' ? fileSource(model.uri) : null
      if (shown.has(key) || !source || source.fromDiff) {
        continue
      }
      shown.set(
        key,
        model.onDidChangeContent(() => controller.changed(key))
      )
      controller.attach({
        key,
        filePath: source.filePath,
        worktreeRoot: source.worktreeRoot,
        repoRoot: source.repoRoot,
        getText: () => model.getValue(),
        setMarkers: (linter, diagnostics) => {
          if (!model.isDisposed()) {
            monaco.editor.setModelMarkers(
              model,
              `lint:${linter}`,
              diagnostics.map((diagnostic) =>
                toLintMarker(linter, diagnostic, monaco.MarkerSeverity, (href) =>
                  monaco.Uri.parse(href)
                )
              )
            )
          }
        }
      })
    }
  }
  // Why a microtask: an editor leaves getEditors only after its dispose event has fired.
  const scheduleRefresh = (): void => queueMicrotask(refresh)
  monaco.editor.onDidCreateEditor((editor) => {
    editor.onDidChangeModel(scheduleRefresh)
    editor.onDidDispose(scheduleRefresh)
    scheduleRefresh()
  })

  const keys = new Map(LINTER_IDS.map((linter) => [linter, settingsKey(linter)]))
  useAppStore.subscribe((state, previous) => {
    if (state.settings === previous.settings) {
      return
    }
    const changed = LINTER_IDS.filter((linter) => keys.get(linter) !== settingsKey(linter))
    for (const linter of changed) {
      keys.set(linter, settingsKey(linter))
      void api.stop({ linter })
    }
    if (changed.length > 0) {
      controller.settingsChanged(changed)
    }
  })
}
