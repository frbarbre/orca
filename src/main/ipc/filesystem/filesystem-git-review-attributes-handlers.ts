import { ipcMain } from 'electron'
import { checkReviewAttributes } from '../../git/check-review-attributes'
import type { GitPathReviewAttributes } from '../../../shared/git-review-attributes'
import {
  getSshGitProvider,
  SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE
} from '../../providers/ssh-git-dispatch'
import { resolveRegisteredWorktreePath } from '../registered-worktree-roots-cache'
import { validateGitRelativeFilePath } from '../filesystem-path-containment'
import { getLocalGitOptionsForRegisteredWorktree } from '../local-worktree-runtime-options'
import type { FilesystemHandlerContext } from './filesystem-handler-context'

export function registerFilesystemGitReviewAttributesHandlers({
  store
}: FilesystemHandlerContext): void {
  ipcMain.handle(
    'git:checkReviewAttributes',
    async (
      _event,
      args: { worktreePath: string; paths: string[]; connectionId?: string }
    ): Promise<GitPathReviewAttributes> => {
      if (args.connectionId) {
        const paths = args.paths.map((p) => validateGitRelativeFilePath(args.worktreePath, p))
        const provider = getSshGitProvider(args.connectionId)
        if (!provider) {
          throw new Error(SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE)
        }
        return provider.checkReviewAttributes(args.worktreePath, paths)
      }
      const worktreePath = await resolveRegisteredWorktreePath(args.worktreePath, store)
      const paths = args.paths.map((p) => validateGitRelativeFilePath(worktreePath, p))
      const gitOptions = getLocalGitOptionsForRegisteredWorktree(
        store,
        args.worktreePath,
        worktreePath
      )
      return checkReviewAttributes(worktreePath, paths, gitOptions)
    }
  )
}
