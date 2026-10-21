import { useState } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import {
  ciTriageInstructions,
  DEFAULT_CI_TRIAGE_INSTRUCTIONS,
  parseCiTriageConfig
} from '../../../../shared/ci-triage'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'
import type { SettingsSearchEntry } from './settings-search'
import { translateSearchKeyword } from './settings-search-keywords'

export function getCiTriageSearchEntry(repo: Repo): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.CiTriageSection.title', 'CI Triage'),
    description: translate(
      'auto.components.settings.CiTriageSection.description',
      "When a workspace PR's CI fails, an agent reads the errors: it reruns noise once, pushes a fix for clear failures like lint, type errors or a branch behind main, and leaves the rest red."
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

// Fork: whether an agent triages a workspace PR's failed CI, and the prompt it follows.
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
  const [prompt, setPrompt] = useState(() => ciTriageInstructions(repo.ciTriage ?? {}))
  const edited = prompt !== DEFAULT_CI_TRIAGE_INSTRUCTIONS
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
            updateRepo(repo.id, {
              ciTriage: checked ? (parseCiTriageConfig({ prompt }) ?? {}) : undefined
            })
          }
        />
      </div>
      {enabled && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ci-triage-prompt" className="text-xs text-muted-foreground">
              {translate('auto.components.settings.CiTriageSection.prompt', 'Agent prompt')}
            </Label>
            {edited && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setPrompt(DEFAULT_CI_TRIAGE_INSTRUCTIONS)
                  updateRepo(repo.id, { ciTriage: {} })
                }}
              >
                {translate('auto.components.settings.CiTriageSection.reset', 'Reset to default')}
              </Button>
            )}
          </div>
          <Textarea
            id="ci-triage-prompt"
            value={prompt}
            rows={14}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            onBlur={() => {
              const next = parseCiTriageConfig({ prompt }) ?? {}
              setPrompt(ciTriageInstructions(next))
              if (next.prompt !== repo.ciTriage?.prompt || repo.ciTriage?.hints) {
                updateRepo(repo.id, { ciTriage: next })
              }
            }}
            className="font-mono text-xs"
          />
        </div>
      )}
    </SearchableSetting>
  )
}
