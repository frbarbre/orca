import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { editor } from 'monaco-editor'
import { useAppStore } from '@/store'
import { useMonacoRevealScheduler } from './use-monaco-reveal-scheduler'

type DiffViewerPendingRevealScrollInput = {
  diffEditorRef: RefObject<editor.IStandaloneDiffEditor | null>
  modifiedEditor: editor.ICodeEditor | null
  filePath: string
  modelKey: string
}

/**
 * Scrolls a diff to the line a pending reveal names, then clears the reveal.
 *
 * Why: a reveal stamped by a review location has to survive the async diff mount, and only the
 * viewer that owns the named file may consume it — otherwise a sibling viewer acks a reveal meant
 * for the file the user is being sent to.
 */
export function useDiffViewerPendingRevealScroll({
  diffEditorRef,
  modifiedEditor,
  filePath,
  modelKey
}: DiffViewerPendingRevealScrollInput): void {
  const pendingEditorReveal = useAppStore((s) => s.pendingEditorReveal)
  const { queueReveal, cancelScheduledReveal, clearTransientRevealHighlight } =
    useMonacoRevealScheduler()
  const revealMatchesThisViewer = pendingEditorReveal?.filePath === filePath
  const consumedModelKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (consumedModelKeyRef.current !== modelKey) {
      // Why: a model swap is a new file, so an earlier consumption must not suppress this one.
      consumedModelKeyRef.current = null
    }
    const diffEditor = diffEditorRef.current
    if (!diffEditor || !modifiedEditor || !pendingEditorReveal || !revealMatchesThisViewer) {
      return
    }
    if (consumedModelKeyRef.current === modelKey) {
      return
    }

    const line = pendingEditorReveal.line
    const column = pendingEditorReveal.column
    const matchLength = pendingEditorReveal.matchLength
    let rafId: number | null = null

    const run = (): void => {
      if (consumedModelKeyRef.current === modelKey) {
        return
      }
      // Why: defer a frame so the comment decorator's view zones are laid out before Monaco
      // measures — the same sequencing the first-change auto-scroll needs.
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (consumedModelKeyRef.current === modelKey) {
          return
        }
        consumedModelKeyRef.current = modelKey
        queueReveal(modifiedEditor, line, column, matchLength, () => {
          useAppStore.getState().setPendingEditorReveal(null)
        })
      })
    }

    // Run now when the diff is already computed; otherwise wait for the computation to land.
    if (diffEditor.getLineChanges()) {
      run()
    }
    const sub = diffEditor.onDidUpdateDiff(() => run())
    return () => {
      sub.dispose()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [
    diffEditorRef,
    modifiedEditor,
    modelKey,
    pendingEditorReveal,
    queueReveal,
    revealMatchesThisViewer
  ])

  useEffect(() => {
    return () => {
      cancelScheduledReveal()
      clearTransientRevealHighlight()
    }
  }, [cancelScheduledReveal, clearTransientRevealHighlight])
}
