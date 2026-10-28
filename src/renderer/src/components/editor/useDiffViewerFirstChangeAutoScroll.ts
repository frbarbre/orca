import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { editor } from 'monaco-editor'
import { diffViewStateCache } from '@/lib/scroll-cache'

const MIN_LAID_OUT_HEIGHT_PX = 50

type DiffViewerFirstChangeAutoScrollInput = {
  diffEditorRef: RefObject<editor.IStandaloneDiffEditor | null>
  modifiedEditor: editor.ICodeEditor | null
  modelKey: string
  pendingScrollCommentId: string | null
  hasPendingReveal?: boolean
}

/** Center once per model after comment view zones settle, avoiding later geometry shifts. */
export function useDiffViewerFirstChangeAutoScroll({
  diffEditorRef,
  modifiedEditor,
  modelKey,
  pendingScrollCommentId,
  hasPendingReveal = false
}: DiffViewerFirstChangeAutoScrollInput): void {
  const didAutoScrollFirstDiffRef = useRef(false)
  const didAutoScrollModelKeyRef = useRef(modelKey)
  useEffect(() => {
    if (didAutoScrollModelKeyRef.current !== modelKey) {
      didAutoScrollModelKeyRef.current = modelKey
      didAutoScrollFirstDiffRef.current = false
    }
    // Fork. Why before the editor check: a slow diff can apply and clear the reveal before its
    // editor reaches this hook, which then scrolled a definition jump back to the first change.
    if (pendingScrollCommentId || hasPendingReveal) {
      // Why: the decorator or a pending reveal owns this scroll, so set the one-shot flag; else we'd
      // re-run and overwrite it when that request flips back to null.
      didAutoScrollFirstDiffRef.current = true
      return
    }
    const diffEditor = diffEditorRef.current
    if (!diffEditor || !modifiedEditor) {
      return
    }
    if (didAutoScrollFirstDiffRef.current) {
      return
    }
    if (diffViewStateCache.get(modelKey)) {
      return
    }
    let rafId: number | null = null
    let layoutSub: { dispose: () => void } | null = null
    const centerOn = (line: number): void => {
      const top = modifiedEditor.getTopForLineNumber(line, true)
      const editorHeight = modifiedEditor.getLayoutInfo().height
      modifiedEditor.setPosition({ lineNumber: line, column: 1 })
      modifiedEditor.setScrollTop(Math.max(0, top - editorHeight / 2))
      didAutoScrollFirstDiffRef.current = true
    }
    const run = (): void => {
      if (didAutoScrollFirstDiffRef.current) {
        return
      }
      const changes = diffEditor.getLineChanges()
      if (!changes || changes.length === 0) {
        return
      }
      const line = Math.max(1, changes[0].modifiedStartLineNumber)
      // Defer one frame so view zones are laid out before measuring; cancel any earlier rAF to avoid a redundant scroll.
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (didAutoScrollFirstDiffRef.current || !modifiedEditor.getModel()) {
          return
        }
        // Fork. Why: a freshly swapped-in diff can still be a few px tall here; centring on that pins the change to the top.
        if (modifiedEditor.getLayoutInfo().height < MIN_LAID_OUT_HEIGHT_PX) {
          layoutSub?.dispose()
          layoutSub = modifiedEditor.onDidLayoutChange((layout) => {
            if (layout.height < MIN_LAID_OUT_HEIGHT_PX || didAutoScrollFirstDiffRef.current) {
              return
            }
            layoutSub?.dispose()
            layoutSub = null
            centerOn(line)
          })
          return
        }
        centerOn(line)
      })
    }
    if (diffEditor.getLineChanges()) {
      run()
    }
    const sub = diffEditor.onDidUpdateDiff(() => run())
    return () => {
      sub.dispose()
      layoutSub?.dispose()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [diffEditorRef, modifiedEditor, modelKey, pendingScrollCommentId, hasPendingReveal])
}
