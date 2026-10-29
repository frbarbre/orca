import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormatResult } from '../../../shared/formatter'

type Settings = { formatters?: Record<string, { enabled?: boolean; command?: string }> }

const state = vi.hoisted(() => ({
  settings: {} as Settings,
  sources: new Map<string, { filePath: string; fromDiff: boolean } | null>(),
  listeners: [] as ((next: { settings: Settings }, previous: { settings: Settings }) => void)[]
}))

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ settings: state.settings }),
    subscribe: (listener: (typeof state.listeners)[number]) => {
      state.listeners.push(listener)
      return () => state.listeners.splice(state.listeners.indexOf(listener), 1)
    }
  }
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('./language-server-file-source', () => ({
  fileSource: (uri: { path: string }) => {
    const source = state.sources.get(uri.path)
    return source ? { ...source, worktreeRoot: '/wt', repoRoot: '/repo', venvSetting: null } : null
  }
}))

const {
  formatEditorBeforeSave,
  formatEditorThenSave,
  formatFileBeforeSave,
  stopFormattersOnSettingsChange,
  trackEditorForFormatting
} = await import('./format-before-save')

function fakeEditor(path: string, text = 'const  x=1') {
  let version = 1
  const model = {
    uri: { scheme: 'file', path },
    isDisposed: () => false,
    getValue: () => text,
    getVersionId: () => version,
    getOptions: () => ({ tabSize: 4, insertSpaces: false })
  }
  const calls: string[] = []
  const editor = {
    getModel: () => model,
    pushUndoStop: vi.fn(() => {
      calls.push('undoStop')
      return true
    }),
    executeEdits: vi.fn(() => {
      calls.push('edit')
      return true
    })
  }
  return { editor, model, calls, type: () => (version += 1) }
}

const formatEdit = { startLine: 0, startCharacter: 5, endLine: 0, endCharacter: 7, text: ' ' }
let format: ReturnType<typeof vi.fn<(args: unknown) => Promise<FormatResult>>>

beforeEach(() => {
  format = vi.fn(async () => ({ ok: true, edits: [formatEdit] }) as FormatResult)
  vi.stubGlobal('window', { api: { formatter: { format, stop: vi.fn() } } })
  state.settings = {}
  state.sources = new Map([
    ['/wt/src/a.ts', { filePath: '/wt/src/a.ts', fromDiff: false }],
    ['/wt/apps/backend/a.py', { filePath: '/wt/apps/backend/a.py', fromDiff: false }]
  ])
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('formatEditorBeforeSave', () => {
  it("asks the file's formatter and applies its edits as one undo step", async () => {
    const { editor, calls } = fakeEditor('/wt/src/a.ts')

    await formatEditorBeforeSave(editor)

    expect(format).toHaveBeenCalledWith({
      formatter: 'oxfmt',
      command: null,
      filePath: '/wt/src/a.ts',
      worktreeRoot: '/wt',
      repoRoot: '/repo',
      venvSetting: null,
      text: 'const  x=1',
      tabSize: 4,
      insertSpaces: false
    })
    expect(editor.executeEdits).toHaveBeenCalledWith('orca.formatOnSave', [
      {
        range: { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 8 },
        text: ' '
      }
    ])
    expect(calls).toEqual(['undoStop', 'edit', 'undoStop'])
  })

  it('formats Python with ruff and passes the path set in settings', async () => {
    state.settings = { formatters: { ruff: { command: '/opt/ruff' } } }
    const { editor } = fakeEditor('/wt/apps/backend/a.py')

    await formatEditorBeforeSave(editor)

    expect(format).toHaveBeenCalledWith(
      expect.objectContaining({ formatter: 'ruff', command: '/opt/ruff' })
    )
  })

  it('leaves the text alone when the formatter is switched off', async () => {
    state.settings = { formatters: { oxfmt: { enabled: false } } }
    const { editor } = fakeEditor('/wt/src/a.ts')

    await formatEditorBeforeSave(editor)

    expect(format).not.toHaveBeenCalled()
    expect(editor.executeEdits).not.toHaveBeenCalled()
  })

  it('leaves diffs and files without a formatter alone', async () => {
    state.sources.set('/wt/src/b.ts', { filePath: '/wt/src/b.ts', fromDiff: true })
    state.sources.set('/wt/go.mod', { filePath: '/wt/go.mod', fromDiff: false })

    await formatEditorBeforeSave(fakeEditor('/wt/src/b.ts').editor)
    await formatEditorBeforeSave(fakeEditor('/wt/go.mod').editor)
    await formatEditorBeforeSave(fakeEditor('/elsewhere/c.ts').editor)

    expect(format).not.toHaveBeenCalled()
  })

  it('drops edits for text that changed while the formatter ran', async () => {
    const { editor, type } = fakeEditor('/wt/src/a.ts')
    format.mockImplementation(async () => {
      type()
      return { ok: true, edits: [formatEdit] }
    })

    await formatEditorBeforeSave(editor)

    expect(editor.executeEdits).not.toHaveBeenCalled()
  })

  it('saves unformatted rather than wait on a formatter that hangs or fails', async () => {
    vi.useFakeTimers()
    format.mockImplementation(() => new Promise(() => {}))
    const { editor } = fakeEditor('/wt/src/a.ts')

    const hanging = formatEditorBeforeSave(editor)
    await vi.advanceTimersByTimeAsync(5000)
    await hanging
    vi.useRealTimers()

    format.mockImplementation(async () => ({ ok: false, error: 'oxfmt exited' }))
    await formatEditorBeforeSave(editor)

    expect(editor.executeEdits).not.toHaveBeenCalled()
  })
})

describe('formatEditorThenSave', () => {
  it('saves the formatted text', async () => {
    const { editor, model } = fakeEditor('/wt/src/a.ts')
    let text = 'const  x=1'
    model.getValue = () => text
    editor.executeEdits.mockImplementation(() => {
      text = 'const x = 1'
      return true
    })
    const save = vi.fn()

    await formatEditorThenSave(editor, save)

    expect(save).toHaveBeenCalledWith('const x = 1')
  })

  it('saves nothing when the editor moved to another file while formatting', async () => {
    const shown = fakeEditor('/wt/src/a.ts')
    const next = fakeEditor('/wt/src/b.ts')
    const editor = { ...shown.editor, getModel: vi.fn(() => shown.model) }
    format.mockImplementation(async () => {
      editor.getModel.mockReturnValue(next.model)
      return { ok: true, edits: [] }
    })
    const save = vi.fn()

    await formatEditorThenSave(editor, save)

    expect(save).not.toHaveBeenCalled()
  })
})

describe('stopFormattersOnSettingsChange', () => {
  it("stops a formatter's servers when its switch or path changes, so the next save starts fresh", () => {
    const stop = vi.fn(async () => {})
    vi.stubGlobal('window', { api: { formatter: { format, stop } } })
    const dispose = stopFormattersOnSettingsChange()
    const change = (settings: Settings): void => {
      const previous = state.settings
      state.settings = settings
      for (const listener of state.listeners) {
        listener({ settings }, { settings: previous })
      }
    }

    change({ formatters: { ruff: { command: '/opt/ruff' } } })
    change({ formatters: { ruff: { command: '/opt/ruff' } } })
    change({ formatters: { ruff: { command: '/opt/ruff' }, oxfmt: { enabled: false } } })
    dispose()
    change({})

    expect(stop.mock.calls).toEqual([[{ formatter: 'ruff' }], [{ formatter: 'oxfmt' }]])
  })
})

describe('formatFileBeforeSave', () => {
  it("formats the open editor showing the file, and only while it's tracked", async () => {
    const shown = fakeEditor('/wt/src/a.ts')
    const other = fakeEditor('/wt/apps/backend/a.py')
    const untrack = trackEditorForFormatting(shown.editor)
    const untrackOther = trackEditorForFormatting(other.editor)

    await formatFileBeforeSave('/wt/src/a.ts')
    untrack()
    await formatFileBeforeSave('/wt/src/a.ts')
    untrackOther()

    expect(shown.editor.executeEdits).toHaveBeenCalledOnce()
    expect(other.editor.executeEdits).not.toHaveBeenCalled()
  })
})
