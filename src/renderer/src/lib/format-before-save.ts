import type * as Monaco from 'monaco-editor'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  FORMATTER_IDS,
  FORMATTERS,
  formatterForFile,
  formatterSettings,
  type FormatResult,
  type FormatterId
} from '../../../shared/formatter'
import { fileSource } from './language-server-file-source'

type FormattableEditor = Pick<
  Monaco.editor.ICodeEditor,
  'getModel' | 'executeEdits' | 'pushUndoStop'
>

// Why a cap: Mod+S must still save when a formatter hangs; an unformatted save beats none.
const FORMAT_TIMEOUT_MS = 3000

const editors = new Set<FormattableEditor>()
const reportedFailures = new Set<string>()

export function trackEditorForFormatting(editor: FormattableEditor): () => void {
  editors.add(editor)
  return () => editors.delete(editor)
}

function withTimeout(result: Promise<FormatResult>): Promise<FormatResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), FORMAT_TIMEOUT_MS)
  })
  return Promise.race([result, timeout]).finally(() => clearTimeout(timer))
}

// Fork: Mod+S runs the file's formatter (`shared/formatter.ts`) and saves what it returns.
export async function formatEditorBeforeSave(editor: FormattableEditor): Promise<void> {
  const model = editor.getModel()
  const api = window.api?.formatter
  const source = model && api ? fileSource(model.uri) : null
  const formatter = source && !source.fromDiff ? formatterForFile(source.filePath) : null
  if (!model || !api || !source || !formatter) {
    return
  }
  const { enabled, command } = formatterSettings(useAppStore.getState().settings, formatter)
  if (!enabled) {
    return
  }
  const version = model.getVersionId()
  const { tabSize, insertSpaces } = model.getOptions()
  const result = await withTimeout(
    api.format({
      formatter,
      command,
      filePath: source.filePath,
      worktreeRoot: source.worktreeRoot,
      repoRoot: source.repoRoot,
      venvSetting: source.venvSetting,
      text: model.getValue(),
      tabSize,
      insertSpaces
    })
  )
  if (result && !result.ok && !reportedFailures.has(`${formatter}:${result.error}`)) {
    reportedFailures.add(`${formatter}:${result.error}`)
    toast.error(
      translate(
        'formatters.unavailable',
        '{{formatter}} could not format the file ({{error}}). Saved it unformatted; set its path or turn it off in Settings → Language Servers.',
        { formatter: FORMATTERS[formatter].name, error: result.error }
      )
    )
  }
  if (!result?.ok || result.edits.length === 0) {
    return
  }
  if (model.isDisposed() || model.getVersionId() !== version) {
    return
  }
  editor.pushUndoStop()
  editor.executeEdits(
    'orca.formatOnSave',
    result.edits.map((edit) => ({
      range: {
        startLineNumber: edit.startLine + 1,
        startColumn: edit.startCharacter + 1,
        endLineNumber: edit.endLine + 1,
        endColumn: edit.endCharacter + 1
      },
      text: edit.text
    }))
  )
  editor.pushUndoStop()
}

export async function formatEditorThenSave(
  editor: FormattableEditor,
  save: (text: string) => void
): Promise<void> {
  const model = editor.getModel()
  await formatEditorBeforeSave(editor)
  // Why the same model: an editor reused for another tab would save this text over that file.
  if (model && !model.isDisposed() && editor.getModel() === model) {
    save(model.getValue())
  }
}

export function stopFormattersOnSettingsChange(): () => void {
  const settingsKey = (formatter: FormatterId): string =>
    JSON.stringify(formatterSettings(useAppStore.getState().settings, formatter))
  const keys = new Map(FORMATTER_IDS.map((formatter) => [formatter, settingsKey(formatter)]))
  return useAppStore.subscribe((state, previous) => {
    if (state.settings === previous.settings) {
      return
    }
    for (const formatter of FORMATTER_IDS) {
      const key = settingsKey(formatter)
      if (keys.get(formatter) !== key) {
        keys.set(formatter, key)
        void window.api?.formatter?.stop({ formatter })
      }
    }
  })
}

export async function formatFileBeforeSave(filePath: string): Promise<void> {
  const editor = [...editors].find((candidate) => {
    const model = candidate.getModel()
    const source = model ? fileSource(model.uri) : null
    return source?.filePath === filePath && !source.fromDiff
  })
  if (editor) {
    await formatEditorBeforeSave(editor)
  }
}
