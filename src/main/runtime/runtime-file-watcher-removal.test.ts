import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLanguageServerRemovalStop } from '../language-server/language-server-removal'
import { createRuntimeFileWatcherRemoval } from './runtime-file-watcher-removal'

vi.mock('../ipc/worktree-watcher-removal', () => ({
  getWorktreeWatcherRemoval: () => ({
    closeLocal: vi.fn(async () => {}),
    closeRemote: vi.fn(async () => {}),
    restoreLocal: vi.fn(async () => {}),
    restoreRemote: vi.fn(async () => {}),
    forgetLocal: vi.fn(),
    forgetRemote: vi.fn()
  })
}))

const fileCommands = {
  closeFileExplorerWatchersForPath: vi.fn(async () => {}),
  restoreFileExplorerWatchersAfterFailedRemoval: vi.fn(async () => {}),
  forgetFileExplorerWatchersAfterRemoval: vi.fn()
}

afterEach(() => setLanguageServerRemovalStop(null))

describe('closing a worktree for removal', () => {
  it("stops the worktree's language servers with its watchers", async () => {
    const stopUnder = vi.fn()
    setLanguageServerRemovalStop(stopUnder)

    await createRuntimeFileWatcherRemoval(fileCommands).close('/wt/e-4446')

    expect(stopUnder).toHaveBeenCalledWith('/wt/e-4446')
  })

  it('leaves local language servers alone for a remote worktree', async () => {
    const stopUnder = vi.fn()
    setLanguageServerRemovalStop(stopUnder)

    await createRuntimeFileWatcherRemoval(fileCommands).close('/wt/e-4446', 'ssh-1')

    expect(stopUnder).not.toHaveBeenCalled()
  })
})
