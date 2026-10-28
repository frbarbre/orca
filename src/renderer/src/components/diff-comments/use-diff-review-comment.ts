import { useCallback, useEffect, useMemo, useState } from 'react'
import type { editor as monacoEditor } from 'monaco-editor'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  collectReviewCommentableLines,
  isRangeInDiff,
  quoteLinesOutsideDiff
} from './review-commentable-lines'
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
  //
  // Why null rather than an empty set until it is known, and why seeded synchronously: an empty
  // set reads as "no line takes a comment", so the first paint disabled the review destinations
  // and the resolved mode fell back to the agent tab -- the popover opened on the wrong tab and
  // visibly switched a frame later, once this effect had run.
  const [commentableLines, setCommentableLines] = useState<ReadonlySet<number> | null>(() =>
    diffEditor ? collectReviewCommentableLines(diffEditor.getLineChanges()) : null
  )
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

  const reviewDisabledReason = target
    ? undefined
    : translate(
        'auto.components.diff.comments.useDiffReviewComment.noPullRequest',
        'This diff is not part of a pull request.'
      )

  const isOutsideDiff = useCallback(
    (lineNumber: number, startLine: number | undefined): boolean =>
      !isRangeInDiff(commentableLines, lineNumber, startLine),
    [commentableLines]
  )

  const prepareReviewComment = useCallback(
    (
      lineNumber: number,
      startLine: number | undefined,
      body: string
    ): { body: string; subjectType?: 'file' } => {
      const model = diffEditor?.getModifiedEditor().getModel()
      if (!model || !isOutsideDiff(lineNumber, startLine)) {
        return { body }
      }
      const first = startLine ?? lineNumber
      const code = model.getValueInRange({
        startLineNumber: first,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: model.getLineMaxColumn(lineNumber)
      })
      return {
        body: quoteLinesOutsideDiff({ line: lineNumber, startLine, code, body }),
        subjectType: 'file'
      }
    },
    [diffEditor, isOutsideDiff]
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
      const prepared = prepareReviewComment(lineNumber, startLine, body)
      const result = await addPRReviewComment(target.repoPath, target.prNumber, prepared.body, {
        repoId: target.repoId,
        prRepo: target.prRepo as never,
        commitId: target.headSha,
        path: relativePath,
        line: lineNumber,
        startLine: startLine === lineNumber ? undefined : startLine,
        ...(prepared.subjectType ? { subjectType: prepared.subjectType } : {})
      })
      if (!result.ok) {
        toast.error(result.error)
        return null
      }
      return result.comment
    },
    [addPRReviewComment, prepareReviewComment, relativePath, target]
  )

  // Why forced back to notes: the toggle must never be left showing a destination this diff cannot reach.
  const resolvedMode: DiffCommentMode = mode !== 'note' && reviewDisabledReason ? 'note' : mode

  return useMemo(
    () => ({
      mode,
      setMode,
      resolvedMode,
      reviewDisabledReason,
      isOutsideDiff,
      prepareReviewComment,
      submitReviewComment
    }),
    [
      isOutsideDiff,
      mode,
      prepareReviewComment,
      resolvedMode,
      reviewDisabledReason,
      setMode,
      submitReviewComment
    ]
  )
}
