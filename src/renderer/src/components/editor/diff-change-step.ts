import type { editor } from 'monaco-editor'

type ChangeStepEditor = Pick<
  editor.IStandaloneDiffEditor,
  'getLineChanges' | 'getModifiedEditor' | 'goToDiff'
>

// Share of the viewport one step scrolls, so the reader keeps the last few lines in view.
const SCROLL_STEP_FRACTION = 0.85

/**
 * Where Monaco's goToDiff considers a change to start in the modified pane.
 *
 * Why the +1: getLineChanges reports a pure deletion as starting on the line before the gap
 * (with end 0), while goToDiff compares against the line after it.
 */
function changeStartLine(change: editor.ILineChange): number {
  return change.modifiedEndLineNumber === 0
    ? change.modifiedStartLineNumber + 1
    : change.modifiedStartLineNumber
}

function changeContainsLine(change: editor.ILineChange, line: number): boolean {
  if (change.modifiedEndLineNumber === 0) {
    return changeStartLine(change) === line
  }
  return line >= change.modifiedStartLineNumber && line <= change.modifiedEndLineNumber
}

/** The change's vertical extent in the modified pane, including the deleted lines drawn beside it. */
function changeExtent(
  modified: editor.ICodeEditor,
  change: editor.ILineChange
): { top: number; bottom: number } {
  const start = change.modifiedStartLineNumber
  if (change.modifiedEndLineNumber === 0) {
    // Why: a pure deletion is a zone of removed lines drawn after its anchor line.
    if (start === 0) {
      return { top: modified.getTopForLineNumber(1, true), bottom: modified.getTopForLineNumber(1) }
    }
    const isLastLine = start >= (modified.getModel()?.getLineCount() ?? 0)
    return {
      top: modified.getBottomForLineNumber(start),
      bottom: isLastLine ? modified.getContentHeight() : modified.getTopForLineNumber(start + 1)
    }
  }
  return {
    top: modified.getTopForLineNumber(start, true),
    bottom: modified.getBottomForLineNumber(change.modifiedEndLineNumber)
  }
}

/**
 * Scrolls a page through the change under the cursor while its far edge is still out of view.
 *
 * Why: a change taller than the viewport would otherwise be skipped past without the reader
 * seeing its end (or, going back, its start).
 */
function scrollWithinCurrentChange(
  diffEditor: ChangeStepEditor,
  direction: 'next' | 'previous'
): boolean {
  const modified = diffEditor.getModifiedEditor()
  const line = modified.getPosition()?.lineNumber
  const change =
    line === undefined
      ? undefined
      : diffEditor.getLineChanges()?.find((candidate) => changeContainsLine(candidate, line))
  if (!change) {
    return false
  }
  const { top, bottom } = changeExtent(modified, change)
  const viewTop = modified.getScrollTop()
  const viewHeight = modified.getLayoutInfo().height
  const viewBottom = viewTop + viewHeight
  if (bottom <= viewTop || top >= viewBottom) {
    return false
  }
  const step = Math.round(viewHeight * SCROLL_STEP_FRACTION)
  if (direction === 'next' && bottom > viewBottom) {
    modified.setScrollTop(Math.min(viewTop + step, bottom - viewHeight))
    return true
  }
  if (direction === 'previous' && top < viewTop) {
    modified.setScrollTop(Math.max(viewTop - step, top))
    return true
  }
  return false
}

/** Whether goToDiff(direction) would move forward/back rather than wrap to the other end. */
export function hasChangeInDirection(
  diffEditor: ChangeStepEditor,
  direction: 'next' | 'previous'
): boolean {
  const changes = diffEditor.getLineChanges()
  const modified = diffEditor.getModifiedEditor()
  const line = modified.getPosition()?.lineNumber
  if (!changes || changes.length === 0 || line === undefined) {
    return false
  }
  if (direction === 'next') {
    // Why: Monaco jumps to the first change from the last line regardless of what follows it.
    if (line === modified.getModel()?.getLineCount()) {
      return false
    }
    return changes.some((change) => changeStartLine(change) > line)
  }
  return changes.some((change) => changeStartLine(change) < line)
}

/**
 * goToDiff that stops at the first and last change instead of wrapping.
 *
 * Why: Monaco cycles back to the first change from the last one, which reads as the view jumping
 * away from where the reviewer was; at either end the step is now a no-op.
 */
export function goToDiffWithoutWrap(
  diffEditor: ChangeStepEditor,
  direction: 'next' | 'previous'
): void {
  if (scrollWithinCurrentChange(diffEditor, direction)) {
    return
  }
  if (hasChangeInDirection(diffEditor, direction)) {
    diffEditor.goToDiff(direction)
  }
}
