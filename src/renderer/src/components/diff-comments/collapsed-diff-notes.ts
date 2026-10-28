// Why module state: a note's view zone is rebuilt whenever its file is reopened, which would reset React state.
const collapsedNoteIds = new Set<string>()

export function isDiffNoteCollapsed(noteId: string): boolean {
  return collapsedNoteIds.has(noteId)
}

export function setDiffNoteCollapsed(noteId: string, collapsed: boolean): void {
  if (collapsed) {
    collapsedNoteIds.add(noteId)
  } else {
    collapsedNoteIds.delete(noteId)
  }
}
