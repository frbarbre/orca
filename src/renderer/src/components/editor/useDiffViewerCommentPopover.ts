import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { editor } from 'monaco-editor'
import { useAppStore } from '@/store'
import { monaco } from '@/lib/monaco-setup'
import {
  getDiffCommentPopoverLeft,
  getDiffCommentPopoverTop
} from '../diff-comments/diff-comment-popover-position'
import type { DiffViewerProps } from './diff-viewer-props'

export type DiffViewerCommentPopover = {
  lineNumber: number
  startLine?: number
  top: number
  left?: number
  lineHeight: number
}

/** The Agent / Comment / Review popover's anchor: opened from a line, kept on it while the editor scrolls. */
export function useDiffViewerCommentPopover({
  modifiedEditor,
  diffBodyRef,
  worktreeId,
  relativePath,
  onAddLineComment
}: {
  modifiedEditor: editor.ICodeEditor | null
  diffBodyRef: RefObject<HTMLDivElement | null>
  worktreeId: string | undefined
  relativePath: string
  onAddLineComment: DiffViewerProps['onAddLineComment']
}) {
  const addDiffComment = useAppStore((s) => s.addDiffComment)
  const [popover, setPopover] = useState<DiffViewerCommentPopover | null>(null)
  const popoverLineNumber = popover?.lineNumber

  const openPopover = useCallback(
    ({ lineNumber, startLine, top }: { lineNumber: number; startLine?: number; top: number }) =>
      setPopover({
        lineNumber,
        startLine,
        top,
        left: modifiedEditor
          ? (getDiffCommentPopoverLeft(modifiedEditor, diffBodyRef.current) ?? undefined)
          : undefined,
        lineHeight: modifiedEditor?.getOption(monaco.editor.EditorOption.lineHeight) ?? 0
      }),
    [diffBodyRef, modifiedEditor]
  )

  // Why keyed on the line number, not the whole anchor: the effect must not re-subscribe on every top update.
  useEffect(() => {
    if (!modifiedEditor || popoverLineNumber === undefined) {
      return
    }
    const update = (): void => {
      const lineHeight = modifiedEditor.getOption(monaco.editor.EditorOption.lineHeight)
      const top = getDiffCommentPopoverTop(modifiedEditor, popoverLineNumber, lineHeight)
      if (top == null) {
        setPopover(null)
        return
      }
      const left = getDiffCommentPopoverLeft(modifiedEditor, diffBodyRef.current)
      setPopover((prev) =>
        prev ? { ...prev, top, left: left == null ? prev.left : left, lineHeight } : prev
      )
    }
    const scrollSub = modifiedEditor.onDidScrollChange(update)
    const contentSub = modifiedEditor.onDidContentSizeChange(update)
    const layoutSub = modifiedEditor.onDidLayoutChange(update)
    return () => {
      scrollSub.dispose()
      contentSub.dispose()
      layoutSub.dispose()
    }
  }, [diffBodyRef, modifiedEditor, popoverLineNumber])

  const submitNote = async (body: string): Promise<void> => {
    if (!popover) {
      return
    }
    if (onAddLineComment) {
      const ok = await onAddLineComment({
        lineNumber: popover.lineNumber,
        startLine: popover.startLine,
        body
      })
      if (ok) {
        setPopover(null)
      }
      return
    }
    if (!worktreeId) {
      return
    }
    // Why: await persistence — a null result (failed save) keeps the popover open for retry instead of losing the draft.
    const result = await addDiffComment({
      worktreeId,
      filePath: relativePath,
      source: 'diff',
      startLine: popover.startLine,
      lineNumber: popover.lineNumber,
      body,
      side: 'modified'
    })
    if (result) {
      setPopover(null)
    } else {
      console.error('Failed to add diff comment — draft preserved')
    }
  }

  return { popover, setPopover, openPopover, submitNote }
}
