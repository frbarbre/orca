import type { GlobalSettings } from '../../shared/global-settings-types'

// Electron menus do not react to settings; rebuild appearance checkboxes after writes.
export const APPEARANCE_MENU_KEYS: readonly (keyof GlobalSettings)[] = [
  'showTasksButton',
  'showAutomationsButton',
  'showMobileButton',
  'showTitlebarAppName',
  // Fork: View > Source Control Sections.
  'sourceControlSectionLayout'
]
