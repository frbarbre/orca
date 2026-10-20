import { useState } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'
import type { SettingsSearchEntry } from './settings-search'
import { translateSearchKeyword } from './settings-search-keywords'

export function getCiTriageSearchEntry(repo: Repo): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.CiTriageSection.title', 'CI Triage'),
    description: translate(
      'auto.components.settings.CiTriageSection.description',
      "When a workspace PR's CI fails, an agent checks whether it is noise, such as a test that already fails on main or a broken runner, and reruns it once if so."
    ),
    keywords: [
      repo.displayName,
      ...translateSearchKeyword('auto.components.settings.CiTriageSection.keywordCi', 'ci'),
      ...translateSearchKeyword('auto.components.settings.CiTriageSection.keywordRerun', 'rerun'),
      ...translateSearchKeyword('auto.components.settings.CiTriageSection.keywordFlaky', 'flaky'),
      ...translateSearchKeyword('auto.components.settings.CiTriageSection.keywordSentry', 'sentry')
    ]
  }
}

// Fork: whether an agent triages a workspace PR's failed CI, and what it should know to do so.
export function CiTriageSection({
  repo,
  updateRepo,
  forceVisible
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
  forceVisible?: boolean
}): React.JSX.Element {
  const entry = getCiTriageSearchEntry(repo)
  const enabled = repo.ciTriage !== undefined
  const [hints, setHints] = useState(repo.ciTriage?.hints ?? '')
  return (
    <SearchableSetting
      title={entry.title}
      description={entry.description ?? ''}
      keywords={entry.keywords ?? []}
      className="space-y-2"
      forceVisible={forceVisible}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label className="text-sm font-semibold">{entry.title}</Label>
          <p className="text-xs text-muted-foreground">{entry.description}</p>
        </div>
        <Switch
          aria-label={translate(
            'auto.components.settings.CiTriageSection.toggle',
            'Triage failed CI with an agent'
          )}
          checked={enabled}
          onCheckedChange={(checked) =>
            updateRepo(repo.id, { ciTriage: checked ? { hints: hints.trim() } : undefined })
          }
        />
      </div>
      {enabled && (
        <div className="space-y-1">
          <Label htmlFor="ci-triage-hints" className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.CiTriageSection.hints',
              'What the agent should know'
            )}
          </Label>
          <Textarea
            id="ci-triage-hints"
            value={hints}
            rows={3}
            placeholder={translate(
              'auto.components.settings.CiTriageSection.hintsPlaceholder',
              'Our Sentry is flowbasedk.sentry.io; main reports e2e failures with source:trunk.'
            )}
            onChange={(event) => setHints(event.currentTarget.value)}
            onBlur={() => {
              if (hints.trim() !== repo.ciTriage?.hints) {
                updateRepo(repo.id, { ciTriage: { hints: hints.trim() } })
              }
            }}
            className="text-xs"
          />
        </div>
      )}
    </SearchableSetting>
  )
}
