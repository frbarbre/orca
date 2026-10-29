import { describe, expect, it } from 'vitest'
import { diagnosticsTouching, readCodeActions, requestOrganizeImports } from './lsp-code-actions'

const URI = 'file:///repo/a.py'

const insertImport = {
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
  newText: 'from logging import getLogger\n'
}

const IMPORT_EDIT = {
  startLine: 0,
  startCharacter: 0,
  endLine: 0,
  endCharacter: 0,
  text: 'from logging import getLogger\n'
}

function diagnostic(line: number, character: number, endCharacter: number) {
  return {
    range: { start: { line, character }, end: { line, character: endCharacter } },
    message: 'Could not find name'
  }
}

describe('readCodeActions', () => {
  it('reads the edits each action makes to the file, from either workspace edit shape', () => {
    expect(
      readCodeActions(
        [
          {
            title: 'Insert import: `from logging import getLogger`',
            kind: 'quickfix',
            isPreferred: true,
            edit: { changes: { [URI]: [insertImport] } }
          },
          {
            title: 'Add import from "logging"',
            edit: {
              documentChanges: [{ textDocument: { uri: URI, version: 3 }, edits: [insertImport] }]
            }
          }
        ],
        URI
      )
    ).toEqual([
      {
        title: 'Insert import: `from logging import getLogger`',
        preferred: true,
        edits: [IMPORT_EDIT]
      },
      { title: 'Add import from "logging"', edits: [IMPORT_EDIT] }
    ])
  })

  it('skips commands, actions without an edit, and actions that change another file', () => {
    expect(
      readCodeActions(
        [
          { title: 'Organize imports', command: 'pyrefly.organize' },
          { title: 'Explain', kind: 'quickfix' },
          {
            title: 'Move to b.py',
            edit: { changes: { [URI]: [insertImport], 'file:///repo/b.py': [insertImport] } }
          },
          {
            title: 'Create b.py',
            edit: { documentChanges: [{ kind: 'create', uri: 'file:///repo/b.py' }] }
          }
        ],
        URI
      )
    ).toEqual([])
    expect(readCodeActions(null, URI)).toEqual([])
  })
})

describe('requestOrganizeImports', () => {
  const removeLine = (line: number) => ({
    range: { start: { line, character: 0 }, end: { line: line + 1, character: 0 } },
    newText: ''
  })
  const unused = (line: number) => ({
    ...diagnostic(line, 7, 11),
    code: 'unused-import',
    tags: [1]
  })

  it("takes the server's own organize-imports action for the whole file", async () => {
    const asked: unknown[] = []
    const edits = await requestOrganizeImports(
      async (_method, params) => {
        asked.push(params)
        return [
          {
            title: 'Organize Imports',
            kind: 'source.organizeImports',
            edit: { changes: { [URI]: [insertImport] } }
          }
        ]
      },
      { uri: URI, diagnostics: [unused(2)], lineCount: 40 }
    )

    expect(edits).toEqual([IMPORT_EDIT])
    expect(asked).toEqual([
      {
        textDocument: { uri: URI },
        range: { start: { line: 0, character: 0 }, end: { line: 40, character: 0 } },
        context: { diagnostics: [], only: ['source.organizeImports'], triggerKind: 1 }
      }
    ])
  })

  it('otherwise removes each unused import through its quick fix, once per line', async () => {
    const asked: { context: { diagnostics: unknown[]; only: string[] } }[] = []
    const edits = await requestOrganizeImports(
      async (_method, params) => {
        const ask = params as {
          context: { diagnostics: { range: { start: { line: number } } }[]; only: string[] }
        }
        asked.push(ask)
        const line = ask.context.diagnostics[0]?.range.start.line
        if (line === undefined) {
          return []
        }
        return [
          { title: 'Generate variable', edit: { changes: { [URI]: [insertImport] } } },
          {
            title: 'Remove unused import',
            edit: { changes: { [URI]: [removeLine(line === 5 ? 4 : line)] } }
          }
        ]
      },
      {
        uri: URI,
        diagnostics: [unused(2), diagnostic(3, 0, 4), unused(4), unused(5)],
        lineCount: 40
      }
    )

    expect(edits).toEqual([
      { startLine: 2, startCharacter: 0, endLine: 3, endCharacter: 0, text: '' },
      { startLine: 4, startCharacter: 0, endLine: 5, endCharacter: 0, text: '' }
    ])
    expect(asked.slice(1).map((ask) => ask.context)).toEqual([
      { diagnostics: [unused(2)], only: ['quickfix'], triggerKind: 1 },
      { diagnostics: [unused(4)], only: ['quickfix'], triggerKind: 1 },
      { diagnostics: [unused(5)], only: ['quickfix'], triggerKind: 1 }
    ])
  })
})

describe('diagnosticsTouching', () => {
  it('keeps the diagnostics that overlap or touch the range', () => {
    const before = diagnostic(4, 0, 3)
    const touching = diagnostic(4, 4, 13)
    const after = diagnostic(4, 20, 25)
    const otherLine = diagnostic(9, 4, 13)
    expect(
      diagnosticsTouching([before, touching, after, otherLine, 'junk'], {
        line: 4,
        character: 13,
        endLine: 4,
        endCharacter: 13
      })
    ).toEqual([touching])
  })
})
