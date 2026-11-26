import { describe, expect, it } from 'vitest'
import type { ShellBlock } from './shell-blocks-model'
import {
  blockCommandText,
  blockOutputText,
  bottomAnchorRows,
  formatBlockDuration,
  isBlockIntact,
  layoutVisibleBlocks,
  relocateShellBlocks,
  shellBlockHeaderLabel
} from './shell-blocks-view'

function bufferOf(rows: (string | [string, 'wrapped'])[]) {
  return {
    length: rows.length,
    getLine: (index: number) => {
      const row = rows[index]
      if (row === undefined) {
        return undefined
      }
      const [text, wrapped] = typeof row === 'string' ? [row, undefined] : row
      return { isWrapped: wrapped === 'wrapped', translateToString: () => text }
    }
  }
}

const block = (overrides: Partial<ShellBlock> = {}): ShellBlock => ({
  id: 1,
  headerLine: 0,
  outputLine: 3,
  endLine: 7,
  exitCode: 0,
  startedAt: 0,
  endedAt: 107,
  cwd: '/Users/me/Documents/github/flowbase',
  branch: 'main',
  node: 'v24.14.0',
  command: 'docker ps',
  ...overrides
})

describe('block text', () => {
  // Padding row, header row, command, the gap zsh prints after it, then the output.
  const buffer = bufferOf([
    '',
    '',
    'docker ps',
    '',
    'failed to connect to the docker API at unix:///Users/me/.orb',
    ['stack/run/docker.sock', 'wrapped'],
    '',
    '',
    'next'
  ])

  it('reads the command and the output, joining wrapped rows and dropping trailing blanks', () => {
    expect(blockCommandText(buffer, block())).toBe('docker ps')
    expect(blockOutputText(buffer, block())).toBe(
      'failed to connect to the docker API at unix:///Users/me/.orbstack/run/docker.sock'
    )
  })

  it('reads a running block’s output up to the end of the buffer', () => {
    expect(blockOutputText(buffer, block({ endLine: null }))).toContain('next')
  })

  it('keeps an empty block, whose command row is blank', () => {
    expect(
      isBlockIntact(
        bufferOf(['', '', '', '', '']),
        block({ headerLine: 0, outputLine: 3, endLine: 3, command: '' })
      )
    ).toBe(true)
    expect(
      isBlockIntact(
        bufferOf(['', 'stale', '', '']),
        block({ headerLine: 0, outputLine: 3, endLine: 3, command: '' })
      )
    ).toBe(false)
  })

  it('treats a block whose rows were wiped by clear as gone', () => {
    expect(isBlockIntact(buffer, block())).toBe(true)
    expect(isBlockIntact(bufferOf(['', '', '', '']), block())).toBe(false)
    expect(isBlockIntact(bufferOf(['', 'stale', 'docker ps']), block())).toBe(false)
  })
})

describe('relocateShellBlocks', () => {
  it('finds blocks again by their padding, header and command rows, wherever the rows moved', () => {
    const restored = bufferOf([
      'older output',
      '',
      '',
      'ls',
      '',
      'a b',
      '',
      '',
      'docker ps',
      '',
      'failed',
      '',
      '',
      ''
    ])
    const saved = [
      block({ id: 1, headerLine: 40, outputLine: 43, endLine: 45, command: 'ls' }),
      block({ id: 2, headerLine: 45, outputLine: 48, endLine: 50, command: 'docker ps' })
    ]
    expect(relocateShellBlocks(restored, saved)).toEqual([
      { block: saved[0], headerLine: 1 },
      { block: saved[1], headerLine: 6 }
    ])
  })

  it('takes the newest match for a repeated command and drops blocks that are gone', () => {
    const restored = bufferOf(['', '', 'ls', '', 'x', '', '', 'ls', '', 'y'])
    const saved = [
      block({ id: 1, command: 'gone' }),
      block({ id: 2, command: 'ls' }),
      block({ id: 3, command: 'ls' })
    ]
    expect(
      relocateShellBlocks(restored, saved).map((item) => [item.block.id, item.headerLine])
    ).toEqual([
      [2, 0],
      [3, 5]
    ])
  })

  it('matches a long command by the part on its first row', () => {
    const restored = bufferOf(['', '', 'echo aaaaaaaa', ['bbbb', 'wrapped']])
    expect(relocateShellBlocks(restored, [block({ command: 'echo aaaaaaaabbbb' })])).toHaveLength(1)
  })
})

describe('header label', () => {
  it('leaves node and changes off an empty block’s header, as Warp does', () => {
    expect(
      shellBlockHeaderLabel(
        block({ command: '', diffStat: { files: 1, insertions: 2, deletions: 0 }, endedAt: 43 }),
        0
      )
    ).toBe('~/Documents/github/flowbase git:(main) (0.043s)')
  })

  it('reads like Warp’s: node, folder, branch and duration', () => {
    expect(shellBlockHeaderLabel(block(), 0)).toBe(
      'v24.14.0 ~/Documents/github/flowbase git:(main) (0.107s)'
    )
  })

  it('shows the changes against HEAD after the branch', () => {
    expect(
      shellBlockHeaderLabel(block({ diffStat: { files: 1, insertions: 106_367, deletions: 0 } }), 0)
    ).toBe('v24.14.0 ~/Documents/github/flowbase git:(main) 1 • +106367 -0 (0.107s)')
    expect(
      shellBlockHeaderLabel(block({ diffStat: { files: 0, insertions: 0, deletions: 0 } }), 0)
    ).toBe('v24.14.0 ~/Documents/github/flowbase git:(main) (0.107s)')
  })

  it('leaves out what is unknown and counts a running block live', () => {
    expect(
      shellBlockHeaderLabel(
        block({ node: null, branch: null, endedAt: null, endLine: null, startedAt: 1000 }),
        12_400
      )
    ).toBe('~/Documents/github/flowbase (11s)')
  })

  it('formats durations', () => {
    expect(formatBlockDuration(68)).toBe('0.068s')
    expect(formatBlockDuration(18_117)).toBe('18.117s')
    expect(formatBlockDuration(65_000)).toBe('1m 5s')
    expect(formatBlockDuration(11_900, { running: true })).toBe('11s')
  })
})

describe('layoutVisibleBlocks', () => {
  it('places each block from its padding row and pins the header of one scrolled past its top', () => {
    const blocks = [
      block({ id: 1, headerLine: 0, outputLine: 3, endLine: 5 }),
      block({ id: 2, headerLine: 5, outputLine: 8, endLine: 30 }),
      block({ id: 3, headerLine: 30, outputLine: 33, endLine: null })
    ]
    expect(layoutVisibleBlocks({ blocks, viewportY: 10, rows: 15, bufferLength: 40 })).toEqual([
      { block: blocks[1], topRow: -5, labelRow: 0, endRow: 20, sticky: true }
    ])
    expect(
      layoutVisibleBlocks({ blocks, viewportY: 0, rows: 10, bufferLength: 40 }).map((item) => [
        item.block.id,
        item.topRow,
        item.labelRow,
        item.endRow,
        item.sticky
      ])
    ).toEqual([
      [1, 0, 1, 5, false],
      [2, 5, 6, 30, false]
    ])
  })

  it('keeps the header in place while its own row is still on screen', () => {
    const blocks = [block({ id: 1, headerLine: 9, outputLine: 12, endLine: 40 })]
    expect(layoutVisibleBlocks({ blocks, viewportY: 10, rows: 15, bufferLength: 40 })).toEqual([
      { block: blocks[0], topRow: -1, labelRow: 0, endRow: 30, sticky: false }
    ])
  })
})

describe('bottomAnchorRows', () => {
  it('pushes short output down so the newest block sits on the input', () => {
    // At a prompt the cursor sits below the next block's padding and header rows.
    expect(bottomAnchorRows({ baseY: 0, rows: 20, cursorY: 7, atPrompt: true })).toBe(15)
    expect(bottomAnchorRows({ baseY: 0, rows: 20, cursorY: 7, atPrompt: false })).toBe(12)
  })

  it('hides the next prompt’s blank rows under the input once output fills the screen', () => {
    expect(
      bottomAnchorRows({ baseY: 30, viewportY: 30, rows: 20, cursorY: 19, atPrompt: true })
    ).toBe(3)
  })

  it('leaves a running command, or a terminal scrolled up, alone', () => {
    expect(
      bottomAnchorRows({ baseY: 30, viewportY: 30, rows: 20, cursorY: 19, atPrompt: false })
    ).toBe(0)
    expect(
      bottomAnchorRows({ baseY: 30, viewportY: 12, rows: 20, cursorY: 19, atPrompt: true })
    ).toBe(0)
    expect(bottomAnchorRows({ baseY: 0, rows: 20, cursorY: 19, atPrompt: false })).toBe(0)
  })
})
