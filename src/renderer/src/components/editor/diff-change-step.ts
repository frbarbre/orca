import type { editor } from 'monaco-editor'

type ChangeStepEditor = Pick<
  editor.IStandaloneDiffEditor,
  'getLineChanges' | 'getModifiedEditor' | 'goToDiff'
>

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
  if (hasChangeInDirection(diffEditor, direction)) {
    diffEditor.goToDiff(direction)
  }
}
