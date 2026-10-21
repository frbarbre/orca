import { describe, expect, it, vi } from 'vitest'
import { findBusyTerminalTabIds } from './busy-terminal-tabs'

const LEAF_DONE = '11111111-1111-4111-8111-111111111111'
const LEAF_WORKING = '22222222-2222-4222-8222-222222222222'
const LEAF_WAITING = '33333333-3333-4333-8333-333333333333'

const probes = vi.hoisted(() => ({
  'pty-build': { verdict: 'live', timedOut: false },
  'pty-shell': { verdict: 'idle', timedOut: false },
  'pty-remote': { verdict: 'unverifiable', timedOut: true },
  'pty-agent-done': { verdict: 'live', timedOut: false },
  'pty-agent-working': { verdict: 'live', timedOut: false },
  'pty-agent-waiting': { verdict: 'live', timedOut: false }
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
      terminalLayoutsByTabId: {
        'term-agent-done': { ptyIdsByLeafId: { [LEAF_DONE]: 'pty-agent-done' } },
        'term-agent-working': { ptyIdsByLeafId: { [LEAF_WORKING]: 'pty-agent-working' } },
        'term-agent-waiting': { ptyIdsByLeafId: { [LEAF_WAITING]: 'pty-agent-waiting' } }
      },
      agentStatusByPaneKey: {
        [`term-agent-done:${LEAF_DONE}`]: { agentType: 'claude', state: 'done' },
        [`term-agent-working:${LEAF_WORKING}`]: { agentType: 'claude', state: 'working' },
        [`term-agent-waiting:${LEAF_WAITING}`]: { agentType: 'claude', state: 'waiting' }
      }
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

  it('counts an agent that reports done as not busy, though its process still runs', async () => {
    const busy = await findBusyTerminalTabIds([
      tab('term-agent-done', 'terminal'),
      tab('term-agent-working', 'terminal'),
      tab('term-agent-waiting', 'terminal')
    ])

    expect([...busy].sort()).toEqual(['term-agent-waiting', 'term-agent-working'])
  })
})
