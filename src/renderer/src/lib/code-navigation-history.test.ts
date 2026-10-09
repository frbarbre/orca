import { describe, expect, it } from 'vitest'
import {
  EMPTY_CODE_HISTORY,
  recordJump,
  stepCodeHistory,
  type CodeLocation
} from './code-navigation-history'

function at(relativePath: string, line: number, inDiff = false): CodeLocation {
  return {
    worktreeId: 'wt-1',
    worktreeRoot: '/repo',
    filePath: `/repo/${relativePath}`,
    relativePath,
    line,
    column: 1,
    inDiff
  }
}

describe('code navigation history', () => {
  it('goes back to where the jump started and forward to where it landed', () => {
    const history = recordJump(EMPTY_CODE_HISTORY, at('a.py', 10), at('b.py', 3))

    const back = stepCodeHistory(history, 'back', null)
    expect(back?.location).toEqual(at('a.py', 10))
    const forward = back && stepCodeHistory(back.history, 'forward', null)
    expect(forward?.location).toEqual(at('b.py', 3))
    expect(forward && stepCodeHistory(forward.history, 'forward', null)).toBeNull()
  })

  it('walks a chain of jumps back to the first place', () => {
    let history = recordJump(EMPTY_CODE_HISTORY, at('a.py', 10), at('b.py', 3))
    history = recordJump(history, at('b.py', 5), at('c.py', 7))

    const toB = stepCodeHistory(history, 'back', null)
    expect(toB?.location).toEqual(at('b.py', 5))
    const toA = toB && stepCodeHistory(toB.history, 'back', null)
    expect(toA?.location).toEqual(at('a.py', 10))
    expect(toA && stepCodeHistory(toA.history, 'back', null)).toBeNull()
  })

  it('drops the forward places when jumping somewhere new after going back', () => {
    let history = recordJump(EMPTY_CODE_HISTORY, at('a.py', 10), at('b.py', 3))
    history = stepCodeHistory(history, 'back', null)?.history ?? history
    history = recordJump(history, at('a.py', 12), at('d.py', 1))

    expect(history.entries).toEqual([at('a.py', 12), at('d.py', 1)])
    expect(stepCodeHistory(history, 'forward', null)).toBeNull()
  })

  it('remembers where the cursor moved to before going back, for going forward again', () => {
    const history = recordJump(EMPTY_CODE_HISTORY, at('a.py', 10), at('b.py', 3))

    const back = stepCodeHistory(history, 'back', at('b.py', 40))
    const forward = back && stepCodeHistory(back.history, 'forward', at('a.py', 10))
    expect(forward?.location).toEqual(at('b.py', 40))
  })

  it("keeps a file's diff and its plain tab as separate places", () => {
    const history = recordJump(EMPTY_CODE_HISTORY, at('a.py', 10, true), at('a.py', 2))

    expect(history.entries).toHaveLength(2)
    expect(stepCodeHistory(history, 'back', null)?.location).toEqual(at('a.py', 10, true))
  })

  it('keeps the last 50 places', () => {
    let history = EMPTY_CODE_HISTORY
    for (let jump = 0; jump < 40; jump++) {
      history = recordJump(history, at(`from-${jump}.py`, 1), at(`to-${jump}.py`, 1))
    }

    expect(history.entries).toHaveLength(50)
    expect(history.index).toBe(49)
    expect(history.entries.at(-1)).toEqual(at('to-39.py', 1))
  })
})
