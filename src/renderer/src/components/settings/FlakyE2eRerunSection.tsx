import { useEffect, useState } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import {
  parseFlakyE2eRerunConfig,
  type FlakyE2eRerunConfig
} from '../../../../shared/flaky-e2e-rerun'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'
import type { SettingsSearchEntry } from './settings-search'
import { translateSearchKeyword } from './settings-search-keywords'

type Draft = Record<keyof FlakyE2eRerunConfig, string>

function draftFrom(config: FlakyE2eRerunConfig | undefined): Draft {
  return {
    sentryUrl: config?.sentryUrl ?? '',
    sentryOrg: config?.sentryOrg ?? '',
    sentryProjectIds: config?.sentryProjectIds.join(', ') ?? '',
    reportArtifact: config?.reportArtifact ?? '',
    reportFile: config?.reportFile ?? '',
    queryTemplate: config?.queryTemplate ?? ''
  }
}

function configFrom(draft: Draft): FlakyE2eRerunConfig | null {
  return parseFlakyE2eRerunConfig({
    ...draft,
    sentryProjectIds: draft.sentryProjectIds.split(',')
  })
}

export function getFlakyE2eRerunSearchEntry(repo: Repo): SettingsSearchEntry {
  return {
    title: translate('auto.components.settings.FlakyE2eRerunSection.title', 'Flaky E2E Reruns'),
    description: translate(
      'auto.components.settings.FlakyE2eRerunSection.description',
      "Rerun a pull request's failed CI once when every failed e2e test already fails on main, as Sentry reports it."
    ),
    keywords: [
      repo.displayName,
      ...translateSearchKeyword(
        'auto.components.settings.FlakyE2eRerunSection.keywordSentry',
        'sentry'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.FlakyE2eRerunSection.keywordFlaky',
        'flaky'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.FlakyE2eRerunSection.keywordRerun',
        'rerun'
      ),
      ...translateSearchKeyword('auto.components.settings.FlakyE2eRerunSection.keywordCi', 'ci')
    ]
  }
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = 'text'
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'password'
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="h-8 font-mono text-xs"
      />
    </div>
  )
}

// Fork: how Orca tells a pull request's failed e2e tests are known flakes on main, to rerun CI.
export function FlakyE2eRerunSection({
  repo,
  updateRepo,
  forceVisible
}: {
  repo: Repo
  updateRepo: (repoId: string, updates: Partial<Repo>) => void
  forceVisible?: boolean
}): React.JSX.Element {
  const entry = getFlakyE2eRerunSearchEntry(repo)
  const [draft, setDraft] = useState(() => draftFrom(repo.flakyE2eRerun))
  const [token, setToken] = useState('')
  const [tokenConfigured, setTokenConfigured] = useState(false)
  useEffect(() => {
    void window.api.pendingReview.sentryTokenConfigured().then(setTokenConfigured)
  }, [])
  const config = configFrom(draft)
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const field = (key: keyof Draft, label: string, placeholder: string) => (
    <Field
      id={`flaky-e2e-${key}`}
      label={label}
      placeholder={placeholder}
      value={draft[key]}
      onChange={set(key)}
    />
  )

  return (
    <SearchableSetting
      title={entry.title}
      description={entry.description ?? ''}
      keywords={entry.keywords ?? []}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <Label className="text-sm font-semibold">{entry.title}</Label>
      <p className="text-xs text-muted-foreground">{entry.description}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {field(
          'sentryUrl',
          translate('auto.components.settings.FlakyE2eRerunSection.sentryUrl', 'Sentry URL'),
          'https://de.sentry.io'
        )}
        {field(
          'sentryOrg',
          translate(
            'auto.components.settings.FlakyE2eRerunSection.sentryOrg',
            'Sentry organization'
          ),
          'flowbasedk'
        )}
        {field(
          'sentryProjectIds',
          translate(
            'auto.components.settings.FlakyE2eRerunSection.sentryProjectIds',
            'Sentry project ids'
          ),
          '4511783953760336, 4511942739099728'
        )}
        {field(
          'reportArtifact',
          translate(
            'auto.components.settings.FlakyE2eRerunSection.reportArtifact',
            'Report artifact'
          ),
          'e2e-report'
        )}
        {field(
          'reportFile',
          translate('auto.components.settings.FlakyE2eRerunSection.reportFile', 'Report file'),
          'results.json'
        )}
        {field(
          'queryTemplate',
          translate('auto.components.settings.FlakyE2eRerunSection.queryTemplate', 'Issue search'),
          'is:unresolved environment:ci source:trunk test_file:{file} test_title:{title}'
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!config}
          onClick={() => config && updateRepo(repo.id, { flakyE2eRerun: config })}
        >
          {translate('auto.components.settings.FlakyE2eRerunSection.save', 'Save')}
        </Button>
        {repo.flakyE2eRerun && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(draftFrom(undefined))
              updateRepo(repo.id, { flakyE2eRerun: undefined })
            }}
          >
            {translate('auto.components.settings.FlakyE2eRerunSection.turnOff', 'Turn off')}
          </Button>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            id="flaky-e2e-sentry-token"
            type="password"
            label={translate('auto.components.settings.FlakyE2eRerunSection.token', 'Sentry token')}
            placeholder={
              tokenConfigured
                ? translate(
                    'auto.components.settings.FlakyE2eRerunSection.tokenSaved',
                    'Saved — enter a new one to replace it'
                  )
                : translate(
                    'auto.components.settings.FlakyE2eRerunSection.tokenPlaceholder',
                    'A token with event:read'
                  )
            }
            value={token}
            onChange={setToken}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!token.trim()}
          onClick={() =>
            void window.api.pendingReview.saveSentryToken(token.trim()).then(() => {
              setToken('')
              setTokenConfigured(true)
            })
          }
        >
          {translate('auto.components.settings.FlakyE2eRerunSection.saveToken', 'Save token')}
        </Button>
      </div>
    </SearchableSetting>
  )
}
