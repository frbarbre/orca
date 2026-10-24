import type { Repo } from '../../../../shared/repo-types'
import { Label } from '../ui/label'
import { RepoSettingsDraftInput } from './repository/RepositorySettingsDraftInput'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'
import type { SettingsSearchEntry } from './settings-search'
import { translateSearchKeyword } from './settings-search-keywords'

export function getPortLabelsSearchEntry(repo: Repo): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.PortLabelsCommandSection.title', 'Port Names'),
    description: translate(
      'auto.components.settings.PortLabelsCommandSection.description',
      'A command that prints the URLs a workspace serves, to name its live ports.'
    ),
    keywords: [
      repo.displayName,
      ...translateSearchKeyword(
        'auto.components.settings.PortLabelsCommandSection.keywordPorts',
        'ports'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.PortLabelsCommandSection.keywordUrls',
        'urls'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.PortLabelsCommandSection.keywordDevServer',
        'dev server'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.PortLabelsCommandSection.keywordFrontend',
        'frontend'
      )
    ]
  }
}

// Fork: the command whose `Label  URL` lines name a workspace's live ports in the sidebar.
export function PortLabelsCommandSection({
  repo,
  updateRepo,
  forceVisible
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
  forceVisible?: boolean
}): React.JSX.Element {
  const entry = getPortLabelsSearchEntry(repo)
  const title = entry.title
  return (
    <SearchableSetting
      title={title}
      description={entry.description ?? ''}
      keywords={entry.keywords ?? []}
      className="space-y-2"
      forceVisible={forceVisible}
    >
      <Label className="text-sm font-semibold">{title}</Label>
      <RepoSettingsDraftInput
        repoId={repo.id}
        storeValue={repo.portLabelsCommand ?? ''}
        placeholder={translate(
          'auto.components.settings.PortLabelsCommandSection.placeholder',
          'mise run print-urls'
        )}
        onTextChange={() => {}}
        onBlur={(e) => {
          const portLabelsCommand = e.currentTarget.value.trim() || undefined
          if (portLabelsCommand !== (repo.portLabelsCommand || undefined)) {
            updateRepo(repo.id, { portLabelsCommand })
          }
        }}
        className="h-9 font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.PortLabelsCommandSection.hint',
          'Runs in the workspace. Each line of the form "Label  http://host:port" names that port, and the Frontend entry gets a quick open button while it is running.'
        )}
      </p>
    </SearchableSetting>
  )
}
