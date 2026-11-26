import { describe, expect, it } from 'vitest'
import type { ShellBlock } from './shell-blocks-model'
import { createShellBlocksStore } from './shell-blocks-store'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    items
  }
}

const block = (id: number): ShellBlock => ({
  id,
  headerLine: id * 5,
  outputLine: id * 5 + 3,
  endLine: id * 5 + 5,
  exitCode: 0,
  startedAt: id,
  endedAt: id + 1,
  cwd: '/repo',
  branch: 'main',
  node: null,
  command: `echo ${id}`
})

describe('shell blocks store', () => {
  it('hands a pane’s blocks to the next launch', () => {
    const storage = memoryStorage()
    createShellBlocksStore(storage).save('tab:leaf', [block(1), block(2)])
    expect(createShellBlocksStore(storage).load('tab:leaf')).toEqual([block(1), block(2)])
  })

  it('forgets a pane whose shell started over', () => {
    const storage = memoryStorage()
    const store = createShellBlocksStore(storage)
    store.save('tab:leaf', [block(1)])
    store.forget('tab:leaf')
    expect(store.load('tab:leaf')).toBeNull()
    expect(createShellBlocksStore(storage).load('tab:leaf')).toBeNull()
  })

  it('keeps only the newest blocks and panes', () => {
    const storage = memoryStorage()
    const store = createShellBlocksStore(storage, { maxBlocks: 2, maxPanes: 2 })
    store.save('a', [block(1), block(2), block(3)])
    store.save('b', [block(4)])
    store.save('c', [block(5)])
    const next = createShellBlocksStore(storage)
    expect(next.load('a')).toBeNull()
    expect(next.load('b')).toEqual([block(4)])
    expect(next.load('c')).toEqual([block(5)])
    store.save('b', [block(1), block(2), block(3)])
    const reloaded = createShellBlocksStore(storage).load('b')
    expect(reloaded?.map((saved) => saved.id)).toEqual([2, 3])
  })

  it('works without storage and ignores what it cannot read', () => {
    const store = createShellBlocksStore(null)
    store.save('tab:leaf', [block(1)])
    expect(store.load('tab:leaf')).toEqual([block(1)])
    const broken = memoryStorage()
    broken.setItem('orca.shellBlocks', '{not json')
    expect(createShellBlocksStore(broken).load('tab:leaf')).toBeNull()
  })
})
