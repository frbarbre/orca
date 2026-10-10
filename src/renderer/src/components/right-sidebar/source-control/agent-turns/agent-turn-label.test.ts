import { describe, expect, it } from 'vitest'
import { agentTurnDetail, agentTurnTitle } from './agent-turn-label'

const turn = {
  ref: 'refs/worktree/orca-turns/1',
  oid: 'b',
  parentOid: 'a',
  prompt: '  Fix the resolve() jump\nand also the tests  ',
  agent: 'claude',
  paneKey: 'tab:leaf',
  startedAt: 0,
  completedAt: 60_000,
  files: 3,
  insertions: 12,
  deletions: 4
}

describe('agent turn label', () => {
  it('titles a turn by the first line of its prompt', () => {
    expect(agentTurnTitle(turn)).toBe('Fix the resolve() jump')
    expect(agentTurnTitle({ ...turn, prompt: '   ' })).toBe('Agent turn')
  })

  it('describes the agent, when it finished and what it changed', () => {
    expect(agentTurnDetail(turn, 180_000)).toBe('claude · 2 minutes ago · 3 files +12 −4')
    expect(agentTurnDetail({ ...turn, files: 1 }, 180_000)).toContain('1 file +12')
  })
})
