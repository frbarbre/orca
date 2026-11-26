import type { ShellBlock } from './shell-blocks-model'
import { displayShellEditorCwd } from './shell-editor-dom'

/** The part of an xterm buffer the block helpers read. */
export type BlockBuffer = {
  readonly length: number
  getLine: (
    index: number
  ) =>
    | { readonly isWrapped: boolean; translateToString: (trimRight: boolean) => string }
    | undefined
}

function rowText(buffer: BlockBuffer, index: number): string {
  return buffer.getLine(index)?.translateToString(true) ?? ''
}

function readRows(buffer: BlockBuffer, from: number, toExclusive: number): string {
  const lines: string[] = []
  for (let index = Math.max(0, from); index < Math.min(toExclusive, buffer.length); index++) {
    const text = rowText(buffer, index)
    if (buffer.getLine(index)?.isWrapped && lines.length > 0) {
      lines[lines.length - 1] += text
    } else {
      lines.push(text)
    }
  }
  while (lines.length > 0 && lines.at(-1)!.trim() === '') {
    lines.pop()
  }
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift()
  }
  return lines.join('\n')
}

/**
 * A block's rows, as zsh prints them for the editor: a padding row and a header row (the prompt's
 * two newlines), the command, then a gap row and the output.
 */
const HEADER_ROW_OFFSET = 1
const COMMAND_ROW_OFFSET = 2

export function blockCommandText(
  buffer: BlockBuffer,
  block: Pick<ShellBlock, 'headerLine' | 'outputLine'>
): string {
  return readRows(buffer, block.headerLine + COMMAND_ROW_OFFSET, block.outputLine)
}

export function blockOutputText(buffer: BlockBuffer, block: ShellBlock): string {
  return readRows(buffer, block.outputLine, block.endLine ?? buffer.length)
}

/** False once `clear` or a redraw wiped the rows the block was drawn over. */
export function isBlockIntact(buffer: BlockBuffer, block: ShellBlock): boolean {
  return (
    rowText(buffer, block.headerLine).trim() === '' &&
    rowText(buffer, block.headerLine + HEADER_ROW_OFFSET).trim() === '' &&
    rowText(buffer, block.headerLine + COMMAND_ROW_OFFSET).trim() !== ''
  )
}

function startsBlockFor(buffer: BlockBuffer, row: number, command: string): boolean {
  const commandRow = rowText(buffer, row + COMMAND_ROW_OFFSET).trimEnd()
  return (
    commandRow !== '' &&
    command.startsWith(commandRow) &&
    rowText(buffer, row).trim() === '' &&
    rowText(buffer, row + HEADER_ROW_OFFSET).trim() === ''
  )
}

/**
 * Finds blocks again in a rebuilt terminal, whose restored rows may sit at other lines than before.
 * Matches newest first from the bottom, so a repeated command lands on its latest run.
 */
export function relocateShellBlocks(
  buffer: BlockBuffer,
  blocks: readonly ShellBlock[]
): { block: ShellBlock; headerLine: number }[] {
  const found: { block: ShellBlock; headerLine: number }[] = []
  let searchFrom = buffer.length - 1 - COMMAND_ROW_OFFSET
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index]
    for (let row = searchFrom; row >= 0; row--) {
      if (block.command && startsBlockFor(buffer, row, block.command)) {
        found.unshift({ block, headerLine: row })
        searchFrom = row - 1
        break
      }
    }
  }
  return found
}

export function formatBlockDuration(ms: number, options: { running?: boolean } = {}): string {
  if (ms >= 60_000) {
    const seconds = Math.floor(ms / 1000)
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }
  return options.running ? `${Math.floor(ms / 1000)}s` : `${(ms / 1000).toFixed(3)}s`
}

export function shellBlockHeaderLabel(block: ShellBlock, now: number): string {
  const running = block.endedAt === null
  const duration = formatBlockDuration((block.endedAt ?? now) - block.startedAt, { running })
  return [
    block.node,
    block.cwd ? displayShellEditorCwd(block.cwd) : null,
    block.branch ? `git:(${block.branch})` : null,
    block.diffStat?.files
      ? `${block.diffStat.files} • +${block.diffStat.insertions} -${block.diffStat.deletions}`
      : null,
    `(${duration})`
  ]
    .filter(Boolean)
    .join(' ')
}

export type VisibleBlock = {
  block: ShellBlock
  /** Viewport row of the block's padding row, where its separator runs; may be above the viewport. */
  topRow: number
  /** Viewport row of the header text; 0 while pinned. */
  labelRow: number
  /** Viewport row just past the block, possibly below the viewport. */
  endRow: number
  /** The header scrolled off while the block still fills the top of the viewport. */
  sticky: boolean
}

export function layoutVisibleBlocks(input: {
  blocks: readonly ShellBlock[]
  viewportY: number
  rows: number
  bufferLength: number
}): VisibleBlock[] {
  const top = input.viewportY
  const bottom = input.viewportY + input.rows
  return input.blocks.flatMap((block) => {
    const end = block.endLine ?? input.bufferLength
    if (end <= top || block.headerLine >= bottom) {
      return []
    }
    const labelRow = block.headerLine + HEADER_ROW_OFFSET - top
    return [
      {
        block,
        topRow: block.headerLine - top,
        labelRow: Math.max(0, labelRow),
        endRow: end - top,
        sticky: labelRow < 0
      }
    ]
  })
}

/**
 * Rows to push the terminal down so its newest output sits on the input, as in Warp.
 * At a prompt zsh's cursor sits three rows below the last output: the next block's padding and
 * header rows, then the command row.
 */
export function bottomAnchorRows(input: {
  baseY: number
  rows: number
  cursorY: number
  atPrompt: boolean
}): number {
  if (input.baseY > 0) {
    return 0
  }
  const lastRow = input.atPrompt ? input.cursorY - COMMAND_ROW_OFFSET - 1 : input.cursorY
  return Math.max(0, input.rows - 1 - lastRow)
}
