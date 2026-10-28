import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LintDiagnostic } from '../../../shared/linter'
import { createLintDiagnosticsController, type LintedModel } from './lint-diagnostics-controller'

const diagnostic: LintDiagnostic = {
  line: 0,
  character: 0,
  endLine: 0,
  endCharacter: 1,
  severity: 1,
  message: 'no'
}

function model(filePath: string, text = 'x') {
  const markers = new Map<string, LintDiagnostic[]>()
  const value: LintedModel & { text: string } = {
    key: `file://${filePath}`,
    filePath,
    worktreeRoot: '/wt',
    repoRoot: '/repo',
    text,
    getText: () => value.text,
    setMarkers: (linter, diagnostics) => markers.set(linter, diagnostics)
  }
  return { value, markers }
}

function setup(enabled = { oxlint: true }) {
  const sync = vi.fn(async () => undefined)
  const close = vi.fn()
  const settings = { current: enabled }
  const controller = createLintDiagnosticsController({
    sync,
    close,
    enabledLinters: (filePath) =>
      filePath.endsWith('.ts') && settings.current.oxlint
        ? [{ linter: 'oxlint' as const, command: null }]
        : [],
    pauseMs: 300
  })
  return { controller, sync, close, settings }
}

describe('lint diagnostics controller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('lints a file when it opens and again once typing pauses, not on every keystroke', () => {
    const { controller, sync } = setup()
    const { value } = model('/wt/a.ts', 'one')

    controller.attach(value)
    value.text = 'two'
    controller.changed(value.key)
    value.text = 'three'
    controller.changed(value.key)
    vi.advanceTimersByTime(299)
    expect(sync).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)

    expect(sync.mock.calls).toEqual([
      [
        {
          linter: 'oxlint',
          command: null,
          filePath: '/wt/a.ts',
          worktreeRoot: '/wt',
          repoRoot: '/repo',
          text: 'one'
        }
      ],
      [
        {
          linter: 'oxlint',
          command: null,
          filePath: '/wt/a.ts',
          worktreeRoot: '/wt',
          repoRoot: '/repo',
          text: 'three'
        }
      ]
    ])
  })

  it("shows a linter's findings on the open file they belong to", () => {
    const { controller } = setup()
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)

    controller.diagnostics({ linter: 'oxlint', filePath: '/wt/a.ts', diagnostics: [diagnostic] })
    controller.diagnostics({ linter: 'oxlint', filePath: '/wt/other.ts', diagnostics: [] })

    expect(markers.get('oxlint')).toEqual([diagnostic])
  })

  it('leaves files no linter reads alone', () => {
    const { controller, sync } = setup()

    controller.attach(model('/wt/a.py').value)

    expect(sync).not.toHaveBeenCalled()
  })

  it('stops linting a file once no editor shows it', () => {
    const { controller, sync, close } = setup()
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)
    controller.changed(value.key)

    controller.detach(value.key)
    vi.advanceTimersByTime(1000)
    controller.diagnostics({ linter: 'oxlint', filePath: '/wt/a.ts', diagnostics: [diagnostic] })

    expect(sync).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledWith({ linter: 'oxlint', filePath: '/wt/a.ts' })
    expect(markers.get('oxlint')).toEqual([])
  })

  it('clears a turned-off linter and lints again when it is turned back on', () => {
    const { controller, sync, settings } = setup()
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)
    controller.diagnostics({ linter: 'oxlint', filePath: '/wt/a.ts', diagnostics: [diagnostic] })

    settings.current = { oxlint: false }
    controller.settingsChanged(['oxlint'])
    expect(markers.get('oxlint')).toEqual([])
    controller.changed(value.key)
    vi.advanceTimersByTime(300)
    expect(sync).toHaveBeenCalledTimes(1)

    settings.current = { oxlint: true }
    controller.settingsChanged(['oxlint'])
    expect(sync).toHaveBeenCalledTimes(2)
  })
})
