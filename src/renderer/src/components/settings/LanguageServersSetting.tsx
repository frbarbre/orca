import type React from 'react'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { LanguageServerLanguage } from '../../../../shared/language-server'
import { translate } from '@/i18n/i18n'
import { languageServerEnabled } from '@/lib/language-server-editor'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSwitchRow } from './SettingsFormControls'

// Fork: one switch per language server; each runs a process per project, so it can be turned off.
export function LanguageServersSetting({
  settings,
  updateSettings
}: {
  settings: Pick<GlobalSettings, 'languageServers'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const toggle = (language: LanguageServerLanguage): void =>
    updateSettings({
      languageServers: {
        ...settings.languageServers,
        [language]: !languageServerEnabled(settings, language)
      }
    })
  const rows: { language: LanguageServerLanguage; label: string; description: string }[] = [
    {
      language: 'python',
      label: translate(
        'auto.components.settings.LanguageServersSetting.python',
        'Python (pyrefly)'
      ),
      description: translate(
        'auto.components.settings.LanguageServersSetting.pythonDescription',
        "Uses the project's venv, or the main checkout's when a worktree has none."
      )
    },
    {
      language: 'typescript',
      label: translate(
        'auto.components.settings.LanguageServersSetting.typescript',
        'TypeScript and JavaScript (tsgo)'
      ),
      description: translate(
        'auto.components.settings.LanguageServersSetting.typescriptDescription',
        "Uses the project's @typescript/native-preview. Off falls back to the editor's built-in, open-files-only TypeScript."
      )
    }
  ]

  return (
    <SearchableSetting
      title={translate('auto.components.settings.LanguageServersSetting.title', 'Language Servers')}
      description={translate(
        'auto.components.settings.LanguageServersSetting.description',
        'Cmd+click go-to-definition and hover types. Each runs a background process per project.'
      )}
      keywords={['language server', 'lsp', 'pyrefly', 'tsgo', 'go to definition', 'hover', 'types']}
      className="space-y-2"
    >
      {rows.map((row) => (
        <SettingsSwitchRow
          key={row.language}
          label={row.label}
          description={row.description}
          checked={languageServerEnabled(settings, row.language)}
          onChange={() => toggle(row.language)}
        />
      ))}
    </SearchableSetting>
  )
}
