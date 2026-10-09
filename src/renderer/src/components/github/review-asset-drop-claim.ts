import { useEffect, type RefObject } from 'react'
import { hasOsFileDragTypes } from '@/lib/os-file-drop-cancellation-guard'

/**
 * Claims OS file drags over a comment box that uploads them. Without the claim the window's
 * unclaimed-drop guard refuses the drop, and an enclosing owner (the editor group) would also
 * open the dropped files as tabs. The editor's own drop handler runs first, on a descendant.
 */
export function useReviewAssetDropClaim(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean
): void {
  useEffect(() => {
    const root = rootRef.current
    if (!root || !enabled) {
      return
    }
    const claim = (event: DragEvent): void => {
      if (!hasOsFileDragTypes(event.dataTransfer?.types)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      if (event.type === 'dragover' && event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }
    root.addEventListener('dragover', claim)
    root.addEventListener('drop', claim)
    return () => {
      root.removeEventListener('dragover', claim)
      root.removeEventListener('drop', claim)
    }
  }, [rootRef, enabled])
}
