import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callMock = vi.fn()

vi.mock('../runtime-client', () => {
  class RuntimeClient {
    readonly isRemote = false
    call = callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()
  }

  class RuntimeClientError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  }

  class RuntimeRpcFailureError extends RuntimeClientError {
    readonly response: unknown

    constructor(response: unknown) {
      super('runtime_error', 'runtime_error')
      this.response = response
    }
  }

  return { RuntimeClient, RuntimeClientError, RuntimeRpcFailureError }
})

import { main } from '../index'
import { buildWorktree, okFixture, queueFixtures, worktreeListFixture } from '../test-fixtures'

const WORKTREE = buildWorktree('/tmp/repo', 'feature')
const SELECTOR = 'id:repo::/tmp/repo'

describe('orca notes CLI handlers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    callMock.mockReset()
    process.exitCode = undefined
    vi.stubEnv('CLAUDECODE', '')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('adds a note on a line range of a file in the current worktree, named after the agent', async () => {
    vi.stubEnv('CLAUDECODE', '1')
    queueFixtures(
      callMock,
      worktreeListFixture([WORKTREE]),
      okFixture('req_show', { worktree: WORKTREE }),
      okFixture('req_add', {
        note: { id: 'note-1', filePath: 'src/App.tsx', startLine: 40, lineNumber: 48 }
      })
    )

    await main(
      [
        'notes',
        'add',
        '--file',
        'App.tsx',
        '--line',
        '40',
        '--end-line',
        '48',
        '--body',
        'Fixed it'
      ],
      '/tmp/repo/src'
    )

    expect(callMock).toHaveBeenLastCalledWith('agentNote.add', {
      worktree: SELECTOR,
      filePath: 'src/App.tsx',
      startLine: 40,
      line: 48,
      body: 'Fixed it',
      agent: 'Claude Code'
    })
    expect(vi.mocked(console.log).mock.calls[0][0]).toBe(
      'Added agent note note-1 on src/App.tsx:40-48.'
    )
    expect(process.exitCode).toBeUndefined()
  })

  it('takes an explicit agent name and a single line', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([WORKTREE]),
      okFixture('req_show', { worktree: WORKTREE }),
      okFixture('req_add', { note: { id: 'note-2', filePath: 'README.md', lineNumber: 3 } })
    )

    await main(
      [
        'notes',
        'add',
        '--file',
        'README.md',
        '--line',
        '3',
        '--body',
        'Reworded',
        '--agent',
        'Codex'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenLastCalledWith('agentNote.add', {
      worktree: SELECTOR,
      filePath: 'README.md',
      line: 3,
      body: 'Reworded',
      agent: 'Codex'
    })
  })

  it('refuses a file outside the worktree', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([WORKTREE]),
      okFixture('req_show', { worktree: WORKTREE })
    )

    await main(['notes', 'add', '--file', '/etc/hosts', '--line', '1', '--body', 'x'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalledWith('agentNote.add', expect.anything())
    expect(process.exitCode).toBe(1)
  })

  it('lists the user notes and the agent notes', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([WORKTREE]),
      okFixture('req_list_notes', {
        userNotes: [{ id: 'u1', filePath: 'src/a.ts', lineNumber: 3, body: 'Rename this' }],
        agentNotes: [
          {
            id: 'a1',
            filePath: 'src/a.ts',
            startLine: 3,
            lineNumber: 4,
            body: 'Renamed',
            agentAuthor: { kind: 'agent', name: 'Codex' }
          }
        ]
      })
    )

    await main(['notes', 'list'], '/tmp/repo')

    expect(callMock).toHaveBeenLastCalledWith('agentNote.list', { worktree: SELECTOR })
    const output = vi.mocked(console.log).mock.calls[0][0]
    expect(output).toContain('User notes (1)')
    expect(output).toContain('u1  src/a.ts:3  Rename this')
    expect(output).toContain('Agent notes (1)')
    expect(output).toContain('a1  src/a.ts:3-4  [Codex] Renamed')
  })

  it('removes an agent note by id', async () => {
    queueFixtures(callMock, worktreeListFixture([WORKTREE]), okFixture('req_rm', { removed: true }))

    await main(['notes', 'rm', '--id', 'a1'], '/tmp/repo')

    expect(callMock).toHaveBeenLastCalledWith('agentNote.remove', { worktree: SELECTOR, id: 'a1' })
    expect(vi.mocked(console.log).mock.calls[0][0]).toBe('Removed agent note a1.')
  })
})
