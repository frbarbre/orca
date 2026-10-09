import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { Label } from '../ui/label'
import { SettingsSwitch } from './SettingsFormControls'

type ClaudeWebDefaultViewSettingProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function ClaudeWebDefaultViewSetting({
  settings,
  updateSettings
}: ClaudeWebDefaultViewSettingProps): React.JSX.Element {
  const enabled = settings.openClaudeTabsInWebView === true
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 shrink space-y-0.5">
        <Label>
          {translate('components.settings.claudeWeb.defaultViewTitle', 'Open Claude in Claude web')}
        </Label>
        <p className="text-xs text-muted-foreground">
          {translate(
            'components.settings.claudeWeb.defaultViewCopy',
            'New Claude Code terminal tabs open in their claude.ai Remote Control page. The terminal keeps running underneath.'
          )}
        </p>
      </div>
      <SettingsSwitch
        checked={enabled}
        ariaLabel={translate(
          'components.settings.claudeWeb.defaultViewToggleLabel',
          'Toggle opening Claude in Claude web'
        )}
        onChange={() => updateSettings({ openClaudeTabsInWebView: !enabled })}
      />
    </div>
  )
}
