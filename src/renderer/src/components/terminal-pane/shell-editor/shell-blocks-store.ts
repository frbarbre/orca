import type { ShellBlock } from './shell-blocks-model'

const STORAGE_KEY = 'orca.shellBlocks'
const DEFAULT_MAX_PANES = 40
const DEFAULT_MAX_BLOCKS = 150

type BlocksStorage = Pick<Storage, 'getItem' | 'setItem'>

/**
 * Each pane's latest blocks, in memory and in storage, so they outlive a rebuilt terminal and a
 * relaunch. Storage keeps the most recently saved panes first in line to survive the cap.
 */
export function createShellBlocksStore(
  storage: BlocksStorage | null,
  options: { maxPanes?: number; maxBlocks?: number } = {}
) {
  const maxPanes = options.maxPanes ?? DEFAULT_MAX_PANES
  const maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS
  const memory = new Map<string, ShellBlock[]>()

  function read(): Record<string, ShellBlock[]> {
    try {
      const raw = storage?.getItem(STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : {}
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, ShellBlock[]>) : {}
    } catch {
      return {}
    }
  }

  function write(update: (saved: Record<string, ShellBlock[]>) => void): void {
    if (!storage) {
      return
    }
    try {
      const saved = read()
      update(saved)
      const kept = Object.entries(saved).slice(-maxPanes)
      storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)))
    } catch {
      // A full or blocked storage only costs the blocks after a relaunch.
    }
  }

  return {
    load(paneKey: string): ShellBlock[] | null {
      const blocks = memory.get(paneKey) ?? read()[paneKey]
      return Array.isArray(blocks) && blocks.length > 0 ? blocks : null
    },
    save(paneKey: string, blocks: readonly ShellBlock[]): void {
      const kept = blocks.slice(-maxBlocks)
      memory.set(paneKey, kept)
      write((saved) => {
        delete saved[paneKey]
        saved[paneKey] = kept
      })
    },
    forget(paneKey: string): void {
      memory.delete(paneKey)
      write((saved) => {
        delete saved[paneKey]
      })
    }
  }
}
