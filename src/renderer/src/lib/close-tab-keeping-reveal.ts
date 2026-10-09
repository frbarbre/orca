type RevealStore<Reveal> = {
  pendingEditorReveal: Reveal | null
  closeFile: (fileId: string) => void
  setPendingEditorReveal: (reveal: Reveal | null) => void
}

// Why: closing a tab clears the pending reveal, which a jump's diff target has not applied yet;
// losing it let the diff scroll to its first change instead of the definition.
export function closeTabKeepingReveal<Reveal>(store: RevealStore<Reveal>, fileId: string): void {
  const reveal = store.pendingEditorReveal
  store.closeFile(fileId)
  if (reveal) {
    store.setPendingEditorReveal(reveal)
  }
}
