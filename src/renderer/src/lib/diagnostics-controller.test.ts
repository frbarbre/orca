import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosticSource, EditorDiagnostic } from '../../../shared/editor-diagnostics'
import { createDiagnosticsController, type DiagnosedModel } from './diagnostics-controller'

const diagnostic: EditorDiagnostic = {
  line: 0,
  character: 0,
  endLine: 0,
  endCharacter: 1,
  severity: 1,
  message: 'no'
}

function model(filePath: string, text = 'x') {
  const markers = new Map<DiagnosticSource, EditorDiagnostic[]>()
  const value: DiagnosedModel & { text: string } = {
    key: `file://${filePath}`,
    filePath,
    worktreeRoot: '/wt',
    repoRoot: '/repo',
    venvSetting: null,
    text,
    getText: () => value.text,
    setMarkers: (source, diagnostics) => markers.set(source, diagnostics)
  }
  return { value, markers }
}

function setup(enabled: Partial<Record<DiagnosticSource, boolean>> = { oxlint: true }) {
  const sync = vi.fn(async (_source: DiagnosticSource, _file: unknown) => undefined)
  const close = vi.fn()
  const settings = { current: enabled }
  const controller = createDiagnosticsController({
    sync,
    close,
    sources: (filePath) =>
      filePath.endsWith('.ts')
        ? (['typescript', 'oxlint'] as const).filter((source) => settings.current[source])
        : [],
    pauseMs: 300
  })
  return { controller, sync, close, settings }
}

const file = (text: string) => ({
  filePath: '/wt/a.ts',
  worktreeRoot: '/wt',
  repoRoot: '/repo',
  venvSetting: null,
  text
})

describe('diagnostics controller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('checks a file when it opens and again once typing pauses, not on every keystroke', () => {
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
      ['oxlint', file('one')],
      ['oxlint', file('three')]
    ])
  })

  it('checks a file with every enabled source and keeps their findings apart', () => {
    const { controller, sync } = setup({ typescript: true, oxlint: true })
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)

    controller.diagnostics({
      source: 'typescript',
      filePath: '/wt/a.ts',
      diagnostics: [diagnostic]
    })
    controller.diagnostics({ source: 'oxlint', filePath: '/wt/a.ts', diagnostics: [] })

    expect(sync.mock.calls.map(([source]) => source)).toEqual(['typescript', 'oxlint'])
    expect(markers.get('typescript')).toEqual([diagnostic])
    expect(markers.get('oxlint')).toEqual([])
  })

  it("shows a source's findings only on the open file they belong to", () => {
    const { controller } = setup()
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)

    controller.diagnostics({
      source: 'oxlint',
      filePath: '/wt/other.ts',
      diagnostics: [diagnostic]
    })
    controller.diagnostics({ source: 'python', filePath: '/wt/a.ts', diagnostics: [diagnostic] })

    expect(markers.size).toBe(0)
  })

  it('leaves the squiggles alone when a source reports the same findings again', () => {
    const { controller } = setup()
    const { value } = model('/wt/a.ts')
    const setMarkers = vi.spyOn(value, 'setMarkers')
    controller.attach(value)

    controller.diagnostics({ source: 'oxlint', filePath: '/wt/a.ts', diagnostics: [diagnostic] })
    controller.diagnostics({
      source: 'oxlint',
      filePath: '/wt/a.ts',
      diagnostics: [{ ...diagnostic }]
    })
    controller.diagnostics({ source: 'oxlint', filePath: '/wt/a.ts', diagnostics: [] })

    expect(setMarkers.mock.calls).toEqual([
      ['oxlint', [diagnostic]],
      ['oxlint', []]
    ])
  })

  it('leaves files no source reads alone', () => {
    const { controller, sync } = setup()

    controller.attach(model('/wt/a.py').value)

    expect(sync).not.toHaveBeenCalled()
  })

  it('stops checking a file once no editor shows it', () => {
    const { controller, sync, close } = setup()
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)
    controller.changed(value.key)

    controller.detach(value.key)
    vi.advanceTimersByTime(1000)
    controller.diagnostics({ source: 'oxlint', filePath: '/wt/a.ts', diagnostics: [diagnostic] })

    expect(sync).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledWith('oxlint', '/wt/a.ts')
    expect(markers.get('oxlint')).toEqual([])
  })

  it('clears a turned-off source and checks again when it is turned back on', () => {
    const { controller, sync, settings } = setup()
    const { value, markers } = model('/wt/a.ts')
    controller.attach(value)
    controller.diagnostics({ source: 'oxlint', filePath: '/wt/a.ts', diagnostics: [diagnostic] })

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
