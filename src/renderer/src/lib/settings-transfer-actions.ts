import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getRepoExecutionHostId } from '../../../shared/execution-host'
import { findReposForProject } from '../../../shared/settings-transfer-projects'
import {
  buildSettingsTransferBundle,
  mergeImportedSettings,
  mergeImportedStatusRules,
  resolveImportedQuickCommands,
  type SettingsTransferBundle
} from '../../../shared/settings-transfer'

export function describeSettingsBundle(bundle: SettingsTransferBundle): string {
  const parts = [
    translate('auto.components.settings.transfer.summarySettings', '{{count}} settings', {
      count: Object.keys(bundle.settings).length
    }),
    translate('auto.components.settings.transfer.summaryUi', '{{count}} layout preferences', {
      count: Object.keys(bundle.ui).length
    })
  ]
  if (bundle.ui.workspaceStatusRules) {
    parts.push(translate('auto.components.settings.transfer.summaryRules', 'automations'))
  }
  if (bundle.projects.length > 0) {
    parts.push(
      translate(
        'auto.components.settings.transfer.summaryProjects',
        'settings of {{count}} projects',
        {
          count: bundle.projects.length
        }
      )
    )
  }
  if (bundle.keybindings !== null) {
    parts.push(translate('auto.components.settings.transfer.summaryKeybindings', 'keybindings'))
  }
  const themes = Object.keys(bundle.editorThemes).length
  if (themes > 0) {
    parts.push(
      translate('auto.components.settings.transfer.summaryThemes', '{{count}} editor themes', {
        count: themes
      })
    )
  }
  return parts.join(', ')
}

export async function buildSettingsExportText(): Promise<string> {
  const [settings, ui, files] = await Promise.all([
    window.api.settings.get(),
    window.api.ui.get(),
    window.api.settingsTransfer.readFiles()
  ])
  const bundle = buildSettingsTransferBundle({
    settings,
    ui,
    repos: useAppStore.getState().repos,
    files
  })
  return JSON.stringify(bundle, null, 2)
}

/** Writes the bundle; the caller reloads so stored values pass Orca's load-time checks. */
export async function applySettingsImport(bundle: SettingsTransferBundle): Promise<void> {
  const ui = { ...bundle.ui }
  if (ui.workspaceStatusRules && typeof ui.workspaceStatusRules === 'object') {
    ui.workspaceStatusRules = mergeImportedStatusRules(
      useAppStore.getState().workspaceStatusRules,
      Object.fromEntries(Object.entries(ui.workspaceStatusRules)),
      Date.now()
    )
  }
  const { repos, updateRepo } = useAppStore.getState()
  const settings = mergeImportedSettings(await window.api.settings.get(), bundle.settings)
  if ('terminalQuickCommands' in settings) {
    settings.terminalQuickCommands = resolveImportedQuickCommands(
      settings.terminalQuickCommands,
      repos
    )
  }
  await window.api.settings.set(settings)
  await window.api.ui.set(ui)
  for (const project of bundle.projects) {
    for (const repo of findReposForProject(repos, project)) {
      await updateRepo(repo.id, project.settings, { hostId: getRepoExecutionHostId(repo) })
    }
  }
  await window.api.settingsTransfer.writeFiles({
    keybindings: bundle.keybindings,
    editorThemes: bundle.editorThemes
  })
  await window.api.keybindings.reload()
}
