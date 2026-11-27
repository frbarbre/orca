import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { Terminal } from '@xterm/xterm'
import { EllipsisVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { ShellBlock, ShellBlockTracker } from './shell-blocks-model'
import {
  blockCommandText,
  blockOutputText,
  bottomAnchorRows,
  isBlockIntact,
  layoutVisibleBlocks,
  shellBlockHeaderLabel,
  type BlockBuffer
} from './shell-blocks-view'

type Geometry = { top: number; left: number; cellHeight: number }

/**
 * Where xterm's rows sit inside its root element, which the overlay fills. Both rects carry the
 * bottom-anchor transform, so it cancels; layout offsets would miss the root's padding.
 */
function readGeometry(terminal: Terminal): Geometry | null {
  const root = terminal.element
  const screen = root?.querySelector<HTMLElement>('.xterm-screen')
  if (!root || !screen || terminal.rows === 0) {
    return null
  }
  const rootRect = root.getBoundingClientRect()
  const screenRect = screen.getBoundingClientRect()
  return {
    top: screenRect.top - rootRect.top,
    left: screenRect.left - rootRect.left,
    cellHeight: screenRect.height / terminal.rows
  }
}

/**
 * Repaints on every terminal frame, scroll and resize, and each second while a command runs.
 * Returns the time of the last repaint, so render stays free of clock reads.
 */
function useTerminalFrame(terminal: Terminal, running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let scheduled = 0
    const schedule = (): void => {
      if (!scheduled) {
        scheduled = requestAnimationFrame(() => {
          scheduled = 0
          setNow(Date.now())
        })
      }
    }
    const subscriptions = [
      terminal.onRender(schedule),
      terminal.onScroll(schedule),
      terminal.onResize(schedule)
    ]
    return () => {
      cancelAnimationFrame(scheduled)
      for (const subscription of subscriptions) {
        subscription.dispose()
      }
    }
  }, [terminal])
  useEffect(() => {
    if (!running) {
      return
    }
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  return now
}

function copy(text: string): void {
  void window.api.ui.writeClipboardText(text)
}

function BlockMenu({
  block,
  buffer
}: {
  block: ShellBlock
  buffer: BlockBuffer
}): React.JSX.Element {
  const command = (): string => blockCommandText(buffer, block)
  const output = (): string => blockOutputText(buffer, block)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shell-block-menu-button"
          aria-label={translate('terminal.shellBlocks.actions', 'Block actions')}
        >
          <EllipsisVertical aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => copy(command())}>
          {translate('terminal.shellBlocks.copyCommand', 'Copy command')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy(output())}>
          {translate('terminal.shellBlocks.copyOutput', 'Copy output')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copy([command(), output()].filter(Boolean).join('\n'))}>
          {translate('terminal.shellBlocks.copyBoth', 'Copy command and output')}
        </DropdownMenuItem>
        {block.cwd || block.branch ? <DropdownMenuSeparator /> : null}
        {block.cwd ? (
          <DropdownMenuItem onSelect={() => copy(block.cwd!)}>
            {translate('terminal.shellBlocks.copyCwd', 'Copy working directory')}
          </DropdownMenuItem>
        ) : null}
        {block.branch ? (
          <DropdownMenuItem onSelect={() => copy(block.branch!)}>
            {translate('terminal.shellBlocks.copyBranch', 'Copy git branch')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Warp-style command blocks drawn over the terminal: headers, separators, failures and actions. */
export function ShellBlocksOverlay({
  terminal,
  tracker,
  atPrompt
}: {
  terminal: Terminal
  tracker: ShellBlockTracker
  atPrompt: boolean
}): React.JSX.Element | null {
  const blocks = useSyncExternalStore(tracker.subscribe, tracker.getBlocks)
  const running = blocks.at(-1)?.endedAt === null
  const now = useTerminalFrame(terminal, running)
  const buffer = terminal.buffer.active
  const normalBuffer = buffer.type === 'normal'

  // Why: Warp keeps the newest block on the input, so short output grows up from the bottom.
  useLayoutEffect(() => {
    const element = terminal.element
    const geometry = readGeometry(terminal)
    if (!element || !geometry) {
      return
    }
    const rows = normalBuffer
      ? bottomAnchorRows({
          baseY: buffer.baseY,
          viewportY: buffer.viewportY,
          rows: terminal.rows,
          cursorY: buffer.cursorY,
          atPrompt
        })
      : 0
    element.style.transform = rows > 0 ? `translateY(${rows * geometry.cellHeight}px)` : ''
    // Why: xterm's viewport is black by default; the canvas hid it until the inset uncovered it.
    const viewport = element.querySelector<HTMLElement>('.xterm-viewport')
    if (viewport) {
      viewport.style.backgroundColor = terminal.options.theme?.background ?? ''
    }
  })
  useEffect(() => {
    const element = terminal.element
    return () => {
      if (element) {
        element.style.transform = ''
        element
          .querySelector<HTMLElement>('.xterm-viewport')
          ?.style.removeProperty('background-color')
      }
    }
  }, [terminal])

  const geometry = normalBuffer ? readGeometry(terminal) : null
  if (!geometry || !terminal.element) {
    return null
  }
  const visible = layoutVisibleBlocks({
    blocks: blocks.filter((block) => isBlockIntact(buffer, block)),
    viewportY: buffer.viewportY,
    rows: terminal.rows,
    bufferLength: buffer.length
  })
  const theme = terminal.options.theme ?? {}
  const foreground = theme.foreground ?? 'currentColor'
  const failure = theme.red ?? '#d0362c'

  return createPortal(
    <div
      className="shell-blocks-overlay"
      style={{
        fontFamily: terminal.options.fontFamily,
        fontSize: (terminal.options.fontSize ?? 13) * 0.92,
        color: `color-mix(in srgb, ${foreground} 55%, transparent)`
      }}
    >
      {visible.map(({ block, topRow, labelRow, endRow, sticky, pinnedCommand }) => {
        const failed = block.exitCode !== null && block.exitCode !== 0
        // Why half rows: a block runs from the middle of its padding row to the middle of the next's.
        const blockTop = geometry.top + Math.max(-0.5, topRow + 0.5) * geometry.cellHeight
        const blockBottom =
          geometry.top + Math.min(endRow + 0.5, terminal.rows + 1) * geometry.cellHeight
        return (
          <div key={block.id} data-shell-block={block.id} data-failed={failed || undefined}>
            <div
              className="shell-block-frame"
              data-failed={failed || undefined}
              style={{
                top: blockTop,
                height: blockBottom - blockTop,
                borderTopColor: `color-mix(in srgb, ${foreground} 12%, transparent)`,
                ...(failed
                  ? {
                      background: `color-mix(in srgb, ${failure} 9%, transparent)`,
                      borderLeftColor: failure
                    }
                  : {})
              }}
            />
            <div
              className="shell-block-header"
              data-sticky={sticky || undefined}
              style={{
                top: geometry.top + labelRow * geometry.cellHeight,
                paddingLeft: geometry.left,
                background: sticky ? theme.background : undefined,
                borderBottomColor: sticky
                  ? `color-mix(in srgb, ${foreground} 12%, transparent)`
                  : undefined
              }}
            >
              <div className="shell-block-header-row" style={{ height: geometry.cellHeight }}>
                <span className="shell-block-label">{shellBlockHeaderLabel(block, now)}</span>
                <BlockMenu block={block} buffer={buffer} />
              </div>
              {pinnedCommand ? (
                <div
                  className="shell-block-command"
                  style={{
                    height: geometry.cellHeight,
                    lineHeight: `${geometry.cellHeight}px`,
                    fontSize: terminal.options.fontSize ?? 13,
                    color: foreground
                  }}
                >
                  {pinnedCommand}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>,
    // Why inside xterm's root: it moves with the bottom-anchor transform.
    terminal.element
  )
}
