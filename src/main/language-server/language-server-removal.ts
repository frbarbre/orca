type StopUnder = (root: string) => void

let stopUnder: StopUnder | null = null

export function setLanguageServerRemovalStop(next: StopUnder | null): void {
  stopUnder = next
}

export function stopLanguageServersForRemoval(root: string): void {
  stopUnder?.(root)
}
