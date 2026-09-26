import { useCallback, useEffect, useMemo, useState } from 'react'
import type { editor as monacoEditor } from 'monaco-editor'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { collectReviewCommentableLines } from './review-commentable-lines'
import { getDiffCommentMode, setDiffCommentMode } from './diff-comment-mode-memory'
import type { DiffCommentMode } from './DiffCommentPopover'
import type { PRComment } from '../../../../shared/github/comment-types'

type ReviewCommentTarget = {
  repoPath: string
  repoId: string
  prNumber: number
  prRepo: unknown
  headSha: string
}

/**
 * Lets a line comment in the diff go to GitHub's review instead of Orca's own notes.
 *
 * Why the destination is a toggle rather than a guess: the same gesture serves two audiences. A
 * note is for the agent working in this worktree; a review comment is for the colleague who opens
 * the pull request. Only the reviewer knows which they meant.
 */
export function useDiffReviewComment({
  diffEditor,
  modelKey,
  target,
  relativePath,
  worktreeId
}: {
  diffEditor: monacoEditor.IStandaloneDiffEditor | null
  modelKey: string | null
  target: ReviewCommentTarget | null
  relativePath: string
  worktreeId: string | null
}) {
  // Why seeded from the registry rather than plain state: this hook mounts with the popover, so a
  // local default would reset the choice on every line the reviewer opens.
  const [mode, setModeState] = useState<DiffCommentMode>(() => getDiffCommentMode(worktreeId))
  const setMode = useCallback(
    (next: DiffCommentMode) => {
      setModeState(next)
      setDiffCommentMode(worktreeId, next)
    },
    [worktreeId]
  )
  const addPRReviewComment = useAppStore((s) => s.addPRReviewComment)

  // Why recomputed on every diff update rather than once: the modified side is the working tree,
  // which changes under the viewer while a review is open.
  const [commentableLines, setCommentableLines] = useState<ReadonlySet<number>>(() => new Set())
  useEffect(() => {
    if (!diffEditor) {
      return
    }
    const refresh = (): void =>
      setCommentableLines(collectReviewCommentableLines(diffEditor.getLineChanges()))
    refresh()
    const sub = diffEditor.onDidUpdateDiff(refresh)
    return () => sub.dispose()
  }, [diffEditor, modelKey])

  const reviewDisabledReason = useCallback(
    (lineNumber: number): string | undefined => {
      if (!target) {
        return translate(
          'auto.components.diff.comments.useDiffReviewComment.noPullRequest',
          'This diff is not part of a pull request.'
        )
      }
      if (!commentableLines.has(lineNumber)) {
        return translate(
          'auto.components.diff.comments.useDiffReviewComment.lineNotInDiff',
          'GitHub only accepts review comments on lines the pull request changed.'
        )
      }
      return undefined
    },
    [commentableLines, target]
  )

  const submitReviewComment = useCallback(
    async (
      lineNumber: number,
      startLine: number | undefined,
      body: string
    ): Promise<PRComment | null> => {
      if (!target) {
        return null
      }
      const result = await addPRReviewComment(target.repoPath, target.prNumber, body, {
        repoId: target.repoId,
        prRepo: target.prRepo as never,
        commitId: target.headSha,
        path: relativePath,
        line: lineNumber,
        startLine: startLine === lineNumber ? undefined : startLine
      })
      if (!result.ok) {
        toast.error(result.error)
        return null
      }
      return result.comment
    },
    [addPRReviewComment, relativePath, target]
  )

  // Why forced back to notes: the toggle must never be left showing a destination this line cannot
  // reach, which happens when the diff updates under an open popover.
  const resolveMode = useCallback(
    (lineNumber: number): DiffCommentMode =>
      mode !== 'note' && reviewDisabledReason(lineNumber) ? 'note' : mode,
    [mode, reviewDisabledReason]
  )

  return useMemo(
    () => ({ mode, setMode, resolveMode, reviewDisabledReason, submitReviewComment }),
    [mode, resolveMode, reviewDisabledReason, setMode, submitReviewComment]
  )
}
