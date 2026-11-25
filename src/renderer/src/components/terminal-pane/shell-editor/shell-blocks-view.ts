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
  return lines.join('\n')
}

export function blockCommandText(buffer: BlockBuffer, block: ShellBlock): string {
  return readRows(buffer, block.headerLine + 1, block.outputLine)
}

export function blockOutputText(buffer: BlockBuffer, block: ShellBlock): string {
  return readRows(buffer, block.outputLine, block.endLine ?? buffer.length)
}

/** False once `clear` or a redraw wiped the rows the block was drawn over. */
export function isBlockIntact(buffer: BlockBuffer, block: ShellBlock): boolean {
  return (
    rowText(buffer, block.headerLine).trim() === '' &&
    rowText(buffer, block.headerLine + 1).trim() !== ''
  )
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
  /** Viewport row of the header; 0 while pinned. */
  headerRow: number
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
    const headerRow = block.headerLine - top
    return [{ block, headerRow: Math.max(0, headerRow), endRow: end - top, sticky: headerRow < 0 }]
  })
}

/**
 * Rows to push the terminal down so its newest output sits on the input, as in Warp.
 * At a prompt zsh's cursor sits two rows below the last output: the next header's blank row and the command row.
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
  const lastRow = input.atPrompt ? input.cursorY - 2 : input.cursorY
  return Math.max(0, input.rows - 1 - lastRow)
}
