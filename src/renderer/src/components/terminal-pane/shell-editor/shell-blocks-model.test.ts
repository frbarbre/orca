import { describe, expect, it, vi } from 'vitest'
import { createShellBlockTracker, type BlockMarker } from './shell-blocks-model'

function marker(line: number): BlockMarker & { isDisposed: boolean } {
  return { line, isDisposed: false }
}

const INFO = { branch: 'main', histfile: null, cwd: '/repo', node: 'v24.14.0' }

describe('shell block tracker', () => {
  it('opens a block when a command starts and closes it with its exit code', () => {
    const tracker = createShellBlockTracker()
    tracker.promptStart(marker(4))
    tracker.promptInfo(INFO)
    tracker.commandStart(marker(6), 1000)

    expect(tracker.getBlocks()).toEqual([
      expect.objectContaining({
        headerLine: 4,
        outputLine: 6,
        endLine: null,
        exitCode: null,
        startedAt: 1000,
        endedAt: null,
        cwd: '/repo',
        branch: 'main',
        node: 'v24.14.0'
      })
    ])

    tracker.commandFinished(marker(9), 1, 3500)
    expect(tracker.getBlocks()[0]).toMatchObject({ endLine: 9, exitCode: 1, endedAt: 3500 })
  })

  it('takes each block’s folder and branch from the prompt it was typed at', () => {
    const tracker = createShellBlockTracker()
    tracker.promptStart(marker(0))
    tracker.promptInfo(INFO)
    tracker.commandStart(marker(2), 1)
    tracker.commandFinished(marker(2), 0, 2)
    tracker.promptStart(marker(2))
    tracker.promptInfo({ ...INFO, cwd: '/repo/src', branch: 'feat/x' })
    tracker.commandStart(marker(4), 3)

    expect(tracker.getBlocks().map((block) => [block.cwd, block.branch])).toEqual([
      ['/repo', 'main'],
      ['/repo/src', 'feat/x']
    ])
  })

  it('gives a block the diff stats read for its prompt, even when they arrive after the report', () => {
    const tracker = createShellBlockTracker()
    tracker.promptStart(marker(0))
    tracker.promptInfo(INFO)
    tracker.setDiffStat({ files: 1, insertions: 106_367, deletions: 0 })
    tracker.commandStart(marker(2), 1)
    expect(tracker.getBlocks()[0].diffStat).toEqual({ files: 1, insertions: 106_367, deletions: 0 })
  })

  it('ignores a command start with no prompt before it, and a finish with no open block', () => {
    const tracker = createShellBlockTracker()
    tracker.commandStart(marker(3), 1)
    tracker.commandFinished(marker(5), 0, 2)
    expect(tracker.getBlocks()).toEqual([])
  })

  it('drops blocks whose header scrolled out of the scrollback', () => {
    const tracker = createShellBlockTracker()
    const header = marker(0)
    tracker.promptStart(header)
    tracker.promptInfo(INFO)
    tracker.commandStart(marker(1), 1)
    header.isDisposed = true
    expect(tracker.getBlocks()).toEqual([])
  })

  it('notifies subscribers on every change', () => {
    const tracker = createShellBlockTracker()
    const listener = vi.fn()
    tracker.subscribe(listener)
    tracker.promptStart(marker(0))
    tracker.promptInfo(INFO)
    tracker.commandStart(marker(1), 1)
    tracker.commandFinished(marker(2), 0, 2)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps at most the newest blocks', () => {
    const tracker = createShellBlockTracker({ maxBlocks: 2 })
    for (let index = 0; index < 3; index++) {
      tracker.promptStart(marker(index * 3))
      tracker.promptInfo(INFO)
      tracker.commandStart(marker(index * 3 + 1), index)
      tracker.commandFinished(marker(index * 3 + 2), 0, index)
    }
    expect(tracker.getBlocks().map((block) => block.headerLine)).toEqual([3, 6])
  })
})
