const MODAL_OVERLAY =
  ':scope > [data-slot="dialog-overlay"], :scope > [data-slot="sheet-overlay"], :scope > [data-onboarding-overlay]'

// Why: a body:has() blur rule made every DOM write restyle the whole app; overlays portal to body's children only.
export function installModalSceneAttribute(body: HTMLElement): () => void {
  const sync = (): void => {
    body.toggleAttribute('data-modal-scene', body.querySelector(MODAL_OVERLAY) !== null)
  }
  sync()
  const observer = new MutationObserver(sync)
  observer.observe(body, { childList: true })
  return () => observer.disconnect()
}
