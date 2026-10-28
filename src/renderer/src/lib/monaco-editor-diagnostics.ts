import type * as Monaco from 'monaco-editor'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { DiagnosticSource } from '../../../shared/editor-diagnostics'
import {
  LANGUAGE_SERVER_LANGUAGES,
  languageServerForFile,
  languageServerOptions,
  languageServerSettings,
  type LanguageServerLanguage
} from '../../../shared/language-server'
import {
  isLinterId,
  LINTER_IDS,
  LINTERS,
  linterSettings,
  lintersForFile
} from '../../../shared/linter'
import { createDiagnosticsController } from './diagnostics-controller'
import { toEditorMarker } from './editor-markers'
import { fileSource } from './language-server-file-source'

const PAUSE_MS = 300

const reportedFailures = new Set<string>()

// Why once per message: every pause in typing would otherwise raise the same toast again.
function reportOnce(key: string, message: () => string): void {
  if (!reportedFailures.has(key)) {
    reportedFailures.add(key)
    toast.error(message())
  }
}

function settings() {
  return useAppStore.getState().settings
}

function typeErrorSettings(language: LanguageServerLanguage) {
  const choice = languageServerSettings(settings(), language)
  return { ...choice, checks: choice.enabled && choice.diagnostics }
}

function enabledSources(filePath: string): DiagnosticSource[] {
  const language = languageServerForFile(filePath)?.language
  return [
    ...(language && typeErrorSettings(language).checks ? [language] : []),
    ...lintersForFile(filePath).filter((linter) => linterSettings(settings(), linter).enabled)
  ]
}

function sourceLabel(source: DiagnosticSource): string {
  if (isLinterId(source)) {
    return LINTERS[source].name
  }
  const { server } = languageServerSettings(settings(), source)
  return languageServerOptions(source)[server]?.name ?? server
}

function settingsKey(source: DiagnosticSource): string {
  return JSON.stringify(
    isLinterId(source) ? linterSettings(settings(), source) : typeErrorSettings(source)
  )
}

// Fork: type errors from each language's server and squiggles from each linter in
// `shared/linter.ts`, for the files open in an editor tab.
export function installMonacoEditorDiagnostics(monaco: typeof Monaco): void {
  const api = window.api
  if (!api?.lint || !api.languageServer) {
    return
  }
  const controller = createDiagnosticsController({
    sources: enabledSources,
    sync: async (source, file) => {
      if (isLinterId(source)) {
        const { command } = linterSettings(settings(), source)
        const result = await api.lint.sync({ linter: source, command, ...file })
        if (!result.ok) {
          reportOnce(`${source}:${result.error}`, () =>
            translate(
              'linters.unavailable',
              '{{linter}} is unavailable ({{error}}). Install it in the project, or set its path or turn it off in Settings → Language Servers.',
              { linter: LINTERS[source].name, error: result.error }
            )
          )
        }
        return
      }
      const { server, command } = languageServerSettings(settings(), source)
      const result = await api.languageServer.sync({ language: source, server, command, ...file })
      if (!result.ok) {
        reportOnce(`${source}:${server}:${result.error}`, () =>
          translate(
            'languageServers.unavailable',
            '{{server}} is unavailable ({{error}}). Install it in the project, or choose another server or its path in Settings → Language Servers.',
            { server: sourceLabel(source), error: result.error }
          )
        )
      }
    },
    close: (source, filePath) =>
      void (isLinterId(source)
        ? api.lint.close({ linter: source, filePath })
        : api.languageServer.closeDocument({ language: source, filePath })),
    pauseMs: PAUSE_MS
  })
  api.lint.onDiagnostics(controller.diagnostics)
  api.languageServer.onDiagnostics(controller.diagnostics)

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
        venvSetting: source.venvSetting,
        getText: () => model.getValue(),
        setMarkers: (diagnosticSource, diagnostics) => {
          if (!model.isDisposed()) {
            const label = sourceLabel(diagnosticSource)
            monaco.editor.setModelMarkers(
              model,
              `diagnostics:${diagnosticSource}`,
              diagnostics.map((diagnostic) =>
                toEditorMarker(label, diagnostic, monaco.MarkerSeverity, (href) =>
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

  const sources: DiagnosticSource[] = [...LANGUAGE_SERVER_LANGUAGES, ...LINTER_IDS]
  const keys = new Map(sources.map((source) => [source, settingsKey(source)]))
  useAppStore.subscribe((state, previous) => {
    if (state.settings === previous.settings) {
      return
    }
    const changed = sources.filter((source) => keys.get(source) !== settingsKey(source))
    for (const source of changed) {
      keys.set(source, settingsKey(source))
      // Why linters only: the language-server providers already stop a language's server.
      if (isLinterId(source)) {
        void api.lint.stop({ linter: source })
      }
    }
    if (changed.length > 0) {
      controller.settingsChanged(changed)
    }
  })
}
