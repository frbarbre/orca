import type React from 'react'
import { FileJson } from 'lucide-react'
import { toast } from 'sonner'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import { MATERIAL_ICON_CONFIG_FILE_NAME } from '../../../../shared/material-icon-config'
import { translate } from '@/i18n/i18n'
import { revealFloatingWorkspacePanel } from '@/lib/floating-workspace-panel-reveal'
import { ensureMaterialIconConfigFile } from '@/lib/material-icons/material-icon-config-sync'
import { useAppStore } from '@/store'
import { Button } from '../ui/button'
import { SearchableSetting } from './SearchableSetting'
import { SettingsRow } from './SettingsFormControls'

async function editIconSettings(): Promise<void> {
  try {
    const { path } = await ensureMaterialIconConfigFile()
    const store = useAppStore.getState()
    // Why the floating workspace: like keybindings.json, the file belongs to no worktree.
    store.openFile(
      {
        filePath: path,
        relativePath: MATERIAL_ICON_CONFIG_FILE_NAME,
        worktreeId: FLOATING_TERMINAL_WORKTREE_ID,
        language: 'json',
        mode: 'edit',
        runtimeEnvironmentId: null
      },
      { preview: false, suppressActiveRuntimeFallback: true }
    )
    if (store.settings?.floatingTerminalEnabled !== true) {
      await store.updateSettings({ floatingTerminalEnabled: true })
    }
    requestAnimationFrame(() => revealFloatingWorkspacePanel(useAppStore.getState()))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

// Fork: Material Icon Theme file and folder icons, configured like the VS Code extension.
export function FileIconsSetting(): React.JSX.Element {
  return (
    <SearchableSetting
      title={translate('auto.components.settings.FileIconsSetting.title', 'File Icons')}
      description={translate(
        'auto.components.settings.FileIconsSetting.description',
        "Material Icon Theme icons in the explorer, tabs and diffs. Customize them with the VS Code extension's settings: files.associations, folders.associations, folders.theme and activeIconPack."
      )}
      keywords={['icons', 'material icon theme', 'file icons', 'folder icons', 'associations']}
      className="space-y-2"
    >
      <SettingsRow
        label={translate('auto.components.settings.FileIconsSetting.title', 'File Icons')}
        description={`${translate(
          'auto.components.settings.FileIconsSetting.description',
          "Material Icon Theme icons in the explorer, tabs and diffs. Customize them with the VS Code extension's settings: files.associations, folders.associations, folders.theme and activeIconPack."
        )} ${translate(
          'auto.components.settings.FileIconsSetting.fileHint',
          'Saved to ~/.orca/material-icon-theme.json and applied on save.'
        )}`}
        control={
          <Button variant="outline" size="sm" onClick={() => void editIconSettings()}>
            <FileJson className="size-3.5" />
            {translate('auto.components.settings.FileIconsSetting.edit', 'Edit icon settings')}
          </Button>
        }
      />
    </SearchableSetting>
  )
}
