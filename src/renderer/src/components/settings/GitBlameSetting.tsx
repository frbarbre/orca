import type React from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { translate } from '@/i18n/i18n'
import { gitBlameSettings } from '@/lib/git-blame-text'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'

// Fork: the cursor line's blame annotation, like VS Code's Git Blame extension.
export function GitBlameSetting({
  settings,
  updateSettings
}: {
  settings: Pick<GlobalSettings, 'gitBlame'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const current = gitBlameSettings(settings)
  const toggle = (key: 'enabled' | 'youForMyCommits'): void =>
    updateSettings({ gitBlame: { ...settings.gitBlame, [key]: !current[key] } })

  return (
    <SearchableSetting
      title={translate('auto.components.settings.GitBlameSetting.title', 'Git Blame')}
      description={translate(
        'auto.components.settings.GitBlameSetting.description',
        "Show who last changed the cursor's line, when, and in which commit and pull request."
      )}
      keywords={['blame', 'git blame', 'author', 'commit', 'pull request']}
      className="space-y-2"
    >
      <SettingsSwitchRow
        label={translate('auto.components.settings.GitBlameSetting.enabled', 'Show line blame')}
        description={translate(
          'auto.components.settings.GitBlameSetting.enabledDescription',
          'Faded text after the line; hover it for the commit, the pull request and actions.'
        )}
        checked={current.enabled}
        onChange={() => toggle('enabled')}
      />
      <SettingsSwitchRow
        label={translate(
          'auto.components.settings.GitBlameSetting.youForMyCommits',
          'Show "You" for my commits'
        )}
        description={translate(
          'auto.components.settings.GitBlameSetting.youForMyCommitsDescription',
          'Uses "You" instead of your name when the line\'s author email is your git user.email.'
        )}
        checked={current.youForMyCommits}
        onChange={() => toggle('youForMyCommits')}
      />
    </SearchableSetting>
  )
}
