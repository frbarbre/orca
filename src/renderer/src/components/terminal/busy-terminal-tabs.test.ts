import { describe, expect, it, vi } from 'vitest'
import { findBusyTerminalTabIds } from './busy-terminal-tabs'

const probes = vi.hoisted(() => ({
  'pty-build': { verdict: 'live', timedOut: false },
  'pty-shell': { verdict: 'idle', timedOut: false },
  'pty-remote': { verdict: 'unverifiable', timedOut: true }
}))
vi.mock('./pty-running-work-probe', () => ({
  probePtyRunningWork: vi.fn(async (ptyIds: string[]) =>
    ptyIds.map((ptyId) => ({ ptyId, ...probes[ptyId as keyof typeof probes] }))
  )
}))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({
      ptyIdsByTabId: {
        'term-build': ['pty-build'],
        'term-shell': ['pty-shell'],
        'term-remote': ['pty-remote']
      },
      terminalLayoutsByTabId: {}
    })
  }
}))

const tab = (id: string, contentType: string) => ({ id, entityId: id, contentType }) as never

describe('findBusyTerminalTabIds', () => {
  it('names the terminal tabs with a running process, or whose process could not be checked in time', async () => {
    const busy = await findBusyTerminalTabIds([
      tab('term-build', 'terminal'),
      tab('term-shell', 'terminal'),
      tab('term-remote', 'terminal'),
      tab('term-unstarted', 'terminal'),
      tab('/code/app/a.ts', 'editor')
    ])

    expect([...busy].sort()).toEqual(['term-build', 'term-remote'])
  })
})
