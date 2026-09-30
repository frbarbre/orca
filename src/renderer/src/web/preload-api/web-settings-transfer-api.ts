import type { PreloadApi } from '../../../../preload/api-types'
import { translate } from '@/i18n/i18n'

export function createWebSettingsTransferApi(): Pick<PreloadApi, 'settingsTransfer'> {
  const desktopOnly = (): string =>
    translate(
      'auto.web.settingsTransfer.desktopOnly',
      'Settings are exported and imported from the desktop app.'
    )
  return {
    settingsTransfer: {
      readFiles: () => Promise.resolve({ keybindings: null, editorThemes: {} }),
      writeFiles: () => Promise.resolve(),
      save: () => Promise.resolve({ ok: false as const, error: desktopOnly() }),
      open: () => Promise.resolve({ ok: false as const, error: desktopOnly() })
    }
  }
}
