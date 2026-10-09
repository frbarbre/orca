import { toast } from 'sonner'
import type { MaterialIconConfigSnapshot } from '../../../../shared/material-icon-config'
import { translate } from '@/i18n/i18n'
import { applyMaterialIconConfig, watchMaterialIconTheme } from './material-icon-store'

let lastReportedErrors = ''

function apply(snapshot: MaterialIconConfigSnapshot): void {
  applyMaterialIconConfig(snapshot.config)
  const errors = snapshot.errors.join('\n')
  // Why once per distinct problem: the watcher re-reads on every save.
  if (errors && errors !== lastReportedErrors) {
    toast.error(
      translate('auto.lib.materialIcons.configErrors', 'Icon settings problems: {{errors}}', {
        errors
      })
    )
  }
  lastReportedErrors = errors
}

// Fork: Material Icon Theme settings from ~/.orca/material-icon-theme.json, applied on every save.
export function startMaterialIconConfigSync(): void {
  watchMaterialIconTheme()
  if (!window.api?.materialIcons) {
    return
  }
  void window.api.materialIcons.read().then(apply, () => {})
  window.api.materialIcons.onChanged(apply)
}

export async function ensureMaterialIconConfigFile(): Promise<MaterialIconConfigSnapshot> {
  const snapshot = await window.api.materialIcons.ensure()
  apply(snapshot)
  return snapshot
}
