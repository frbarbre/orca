import { availableIconPacks, generateManifest } from 'material-icon-theme'
import { create } from 'zustand'
import type { MaterialIconConfig } from '../../../../shared/material-icon-config'
import type { IconManifest } from './material-icon-resolve'

type MaterialIconState = { manifest: IconManifest; light: boolean }

function isLightTheme(): boolean {
  return typeof document !== 'undefined' && !document.documentElement.classList.contains('dark')
}

export const useMaterialIcons = create<MaterialIconState>(() => ({
  manifest: generateManifest({}),
  light: isLightTheme()
}))

export function applyMaterialIconConfig({ activeIconPack, ...config }: MaterialIconConfig): void {
  const iconPack = availableIconPacks.find((pack) => pack === activeIconPack)
  useMaterialIcons.setState({
    manifest: generateManifest(iconPack ? { ...config, activeIconPack: iconPack } : config)
  })
}

// Why observe: the theme class flips on the root element, and a few icons have light variants.
export function watchMaterialIconTheme(): void {
  if (typeof MutationObserver === 'undefined') {
    return
  }
  new MutationObserver(() => {
    const light = isLightTheme()
    if (light !== useMaterialIcons.getState().light) {
      useMaterialIcons.setState({ light })
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}
