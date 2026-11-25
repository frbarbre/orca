import { describe, expect, it } from 'vitest'
import type { ShellBlock } from './shell-blocks-model'
import {
  blockCommandText,
  blockOutputText,
  bottomAnchorRows,
  formatBlockDuration,
  isBlockIntact,
  layoutVisibleBlocks,
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
  outputLine: 2,
  endLine: 5,
  exitCode: 0,
  startedAt: 0,
  endedAt: 107,
  cwd: '/Users/me/Documents/github/flowbase',
  branch: 'main',
  node: 'v24.14.0',
  ...overrides
})

describe('block text', () => {
  const buffer = bufferOf([
    '',
    'docker ps',
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

  it('treats a block whose rows were wiped by clear as gone', () => {
    expect(isBlockIntact(buffer, block())).toBe(true)
    expect(isBlockIntact(bufferOf(['', '', '', '']), block())).toBe(false)
    expect(isBlockIntact(bufferOf(['stale', 'docker ps']), block())).toBe(false)
  })
})

describe('header label', () => {
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
  it('places headers in viewport rows and pins the header of a block scrolled past its top', () => {
    const blocks = [
      block({ id: 1, headerLine: 0, outputLine: 2, endLine: 4 }),
      block({ id: 2, headerLine: 4, outputLine: 6, endLine: 30 }),
      block({ id: 3, headerLine: 30, outputLine: 32, endLine: null })
    ]
    expect(layoutVisibleBlocks({ blocks, viewportY: 10, rows: 15, bufferLength: 40 })).toEqual([
      { block: blocks[1], headerRow: 0, endRow: 20, sticky: true }
    ])
    expect(
      layoutVisibleBlocks({ blocks, viewportY: 0, rows: 10, bufferLength: 40 }).map((item) => [
        item.block.id,
        item.headerRow,
        item.endRow,
        item.sticky
      ])
    ).toEqual([
      [1, 0, 4, false],
      [2, 4, 30, false]
    ])
  })
})

describe('bottomAnchorRows', () => {
  it('pushes short output down so the newest block sits on the input', () => {
    expect(bottomAnchorRows({ baseY: 0, rows: 20, cursorY: 7, atPrompt: true })).toBe(14)
    expect(bottomAnchorRows({ baseY: 0, rows: 20, cursorY: 7, atPrompt: false })).toBe(12)
  })

  it('leaves a full or scrolled terminal alone', () => {
    expect(bottomAnchorRows({ baseY: 3, rows: 20, cursorY: 19, atPrompt: true })).toBe(0)
    expect(bottomAnchorRows({ baseY: 0, rows: 20, cursorY: 19, atPrompt: false })).toBe(0)
  })
})
