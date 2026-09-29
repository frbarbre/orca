import { describe, expect, it } from 'vitest'
import { isTemporaryCheckoutWorkspace } from './visible-worktree-kinds'

function worktree(path: string, isMainWorktree = false) {
  return { path, isMainWorktree }
}

describe('isTemporaryCheckoutWorkspace', () => {
  it('recognises checkouts agents make in temp folders', () => {
    for (const path of [
      '/private/tmp/claude-501/session/scratchpad/wt2',
      '/tmp/review-3179',
      '/var/folders/x1/abc/T/wt',
      '/private/var/folders/x1/abc/T/wt',
      'C:\\Users\\me\\AppData\\Local\\Temp\\wt'
    ]) {
      expect(isTemporaryCheckoutWorkspace(worktree(path))).toBe(true)
    }
  })

  it('leaves real workspaces and the main checkout alone', () => {
    expect(
      isTemporaryCheckoutWorkspace(worktree('/Users/me/orca/workspaces/flowbase/e-4861'))
    ).toBe(false)
    expect(isTemporaryCheckoutWorkspace(worktree('/Users/me/tmp-notes/wt'))).toBe(false)
    expect(isTemporaryCheckoutWorkspace(worktree('/tmp/repo', true))).toBe(false)
  })
})
