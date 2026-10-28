import { describe, expect, it } from 'vitest'
import type { EditorDiagnostic } from '../../shared/editor-diagnostics'
import { createHemolintFilter } from './hemolint-baseline'

const finding = (line: number, code: string): EditorDiagnostic => ({
  line,
  character: 4,
  endLine: line,
  endCharacter: 9,
  severity: 1,
  code,
  message: code
})

const files: Record<string, string> = {
  '/wt/apps/backend/.hemolint/pyrefly-unused-call-result/api/views.py.json': JSON.stringify({
    'save(user)': 1
  }),
  '/wt/apps/backend/.hemolint/pyrefly-unknown-argument-type/api/views.py.json': JSON.stringify({
    'send(payload)': 2
  })
}

const filter = createHemolintFilter({
  exists: (path) => path === '/wt/apps/backend/.hemolint' || path in files,
  readFile: (path) => files[path] ?? null
})

const text = [
  'def view():',
  '    save(user)',
  '    save(user)',
  '    send(payload)',
  '    send(payload)',
  '    other()'
].join('\n')

describe('hemolint baseline filter', () => {
  it('hides the findings the baseline accepts, as many times as it counts them', () => {
    const kept = filter({
      tool: 'pyrefly',
      filePath: '/wt/apps/backend/api/views.py',
      worktreeRoot: '/wt',
      text,
      diagnostics: [
        finding(1, 'unused-call-result'),
        finding(2, 'unused-call-result'),
        finding(3, 'unknown-argument-type'),
        finding(4, 'unknown-argument-type'),
        finding(5, 'unused-call-result')
      ]
    })

    expect(kept).toEqual([finding(2, 'unused-call-result'), finding(5, 'unused-call-result')])
  })

  it('keeps every finding outside a project with a baseline', () => {
    const diagnostics = [finding(1, 'unused-call-result')]

    expect(
      filter({
        tool: 'pyrefly',
        filePath: '/elsewhere/api/views.py',
        worktreeRoot: '/elsewhere',
        text,
        diagnostics
      })
    ).toEqual(diagnostics)
  })

  it('keeps a finding without a rule or a baseline file', () => {
    const noCode = { ...finding(1, ''), code: undefined }
    const otherRule = finding(1, 'missing-import')

    expect(
      filter({
        tool: 'pyrefly',
        filePath: '/wt/apps/backend/api/views.py',
        worktreeRoot: '/wt',
        text,
        diagnostics: [noCode, otherRule]
      })
    ).toEqual([noCode, otherRule])
  })
})
