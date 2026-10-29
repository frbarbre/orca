import { useState } from 'react'
import type React from 'react'
import { ExternalLink, RotateCw } from 'lucide-react'
import { Button } from '../ui/button'
import { restartLanguageServers } from '@/lib/restart-language-servers'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import {
  LANGUAGE_SERVER_LANGUAGES,
  LANGUAGE_SERVERS,
  languageServerOptions,
  languageServerSettings,
  type LanguageServerLanguage
} from '../../../../shared/language-server'
import { LINTER_IDS, LINTERS, linterSettings, type LinterId } from '../../../../shared/linter'
import {
  FORMATTER_IDS,
  FORMATTERS,
  formatterSettings,
  type FormatterId
} from '../../../../shared/formatter'
import { translate } from '@/i18n/i18n'
import {
  RENDERER_FORMATTERS,
  RENDERER_LANGUAGE_SERVERS,
  RENDERER_LINTERS
} from '@/lib/language-server-languages'
import { MaterialNamedIcon } from '@/lib/material-icons/material-icon'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SearchableSetting } from './SearchableSetting'
import { SettingsSegmentedControl, SettingsSwitch } from './SettingsFormControls'
import { getLanguageServersSearchEntries } from './language-servers-search'

type Props = {
  settings: Pick<GlobalSettings, 'languageServers' | 'linters' | 'formatters'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

type Choice = {
  enabled: boolean
  server: string
  command: string | null
  diagnostics: boolean
  completions: boolean
  quickFixes: boolean
  organizeImports: boolean
}

function FeatureSwitch({
  label,
  ariaLabel,
  checked,
  onChange
}: {
  label: string
  ariaLabel: string
  checked: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="shrink-0 text-xs text-muted-foreground">{label}</Label>
      <SettingsSwitch checked={checked} ariaLabel={ariaLabel} onChange={onChange} />
    </div>
  )
}

function CommandField({
  command,
  defaultCommand,
  onCommit
}: {
  command: string | null
  defaultCommand: string
  onCommit: (command: string | null) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(command ?? '')
  const commit = (): void => {
    const next = draft.trim() || null
    if (next !== command) {
      onCommit(next)
    }
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="shrink-0 text-xs text-muted-foreground">
        {translate('languageServers.path', 'Path')}
      </Label>
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit()
          }
        }}
        spellCheck={false}
        placeholder={translate(
          'languageServers.pathPlaceholder',
          '{{command}} from the project, else PATH',
          { command: defaultCommand }
        )}
        className="h-7 w-80 font-mono text-xs md:text-xs"
      />
    </div>
  )
}

function LanguageServerCard({
  language,
  choice,
  onChange
}: {
  language: LanguageServerLanguage
  choice: Choice
  onChange: (next: Choice) => void
}): React.JSX.Element {
  const meta = RENDERER_LANGUAGE_SERVERS[language]
  const servers = languageServerOptions(language)
  const label = meta.label()
  const restartLabel = translate('languageServers.restartAction', 'Restart Language Server')
  return (
    <div
      data-language-server={language}
      className="rounded-lg border border-border/60 bg-card/40 px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <MaterialNamedIcon icon={LANGUAGE_SERVERS[language].icon} size={28} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <Label className="text-sm">{label}</Label>
          <p className="text-xs text-muted-foreground">{meta.description()}</p>
        </div>
        {choice.enabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={restartLabel}
            title={restartLabel}
            onClick={() => void restartLanguageServers([language])}
          >
            <RotateCw className="size-3.5" />
          </Button>
        ) : null}
        <SettingsSwitch
          checked={choice.enabled}
          ariaLabel={label}
          onChange={() => onChange({ ...choice, enabled: !choice.enabled })}
        />
      </div>
      {choice.enabled ? (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between gap-4">
            <Label className="shrink-0 text-xs text-muted-foreground">
              {translate('languageServers.server', 'Server')}
            </Label>
            <div className="flex items-center gap-2">
              <SettingsSegmentedControl
                size="sm"
                value={choice.server}
                ariaLabel={translate('languageServers.serverFor', '{{language}} server', {
                  language: label
                })}
                options={Object.entries(servers).map(([id, server]) => ({
                  value: id,
                  label: server.name
                }))}
                onChange={(server) => onChange({ ...choice, server, command: null })}
              />
              <a
                href={servers[choice.server].homepage}
                target="_blank"
                rel="noreferrer"
                aria-label={translate('languageServers.docs', 'Open {{server}} docs', {
                  server: servers[choice.server].name
                })}
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
          <CommandField
            // Why remount per server: a saved path belongs to the server it was set for.
            key={choice.server}
            command={choice.command}
            defaultCommand={servers[choice.server].command}
            onCommit={(command) => onChange({ ...choice, command })}
          />
          <FeatureSwitch
            label={translate('languageServers.typeErrors', 'Type errors')}
            ariaLabel={translate('languageServers.typeErrorsFor', '{{language}} type errors', {
              language: label
            })}
            checked={choice.diagnostics}
            onChange={() => onChange({ ...choice, diagnostics: !choice.diagnostics })}
          />
          <FeatureSwitch
            label={translate('languageServers.suggestions', 'Suggestions')}
            ariaLabel={translate('languageServers.suggestionsFor', '{{language}} suggestions', {
              language: label
            })}
            checked={choice.completions}
            onChange={() => onChange({ ...choice, completions: !choice.completions })}
          />
          <FeatureSwitch
            label={translate('languageServers.quickFixes', 'Quick fixes')}
            ariaLabel={translate('languageServers.quickFixesFor', '{{language}} quick fixes', {
              language: label
            })}
            checked={choice.quickFixes}
            onChange={() => onChange({ ...choice, quickFixes: !choice.quickFixes })}
          />
          <FeatureSwitch
            label={translate('languageServers.organizeImportsSwitch', 'Organize imports (⌥⇧O)')}
            ariaLabel={translate(
              'languageServers.organizeImportsFor',
              '{{language}} organize imports',
              { language: label }
            )}
            checked={choice.organizeImports}
            onChange={() => onChange({ ...choice, organizeImports: !choice.organizeImports })}
          />
        </div>
      ) : null}
    </div>
  )
}

type ToolChoice = { enabled: boolean; command: string | null }

function ToolCard({
  dataAttributes,
  spec,
  description,
  choice,
  onChange
}: {
  dataAttributes: Record<`data-${string}`, string>
  spec: { name: string; command: string; homepage: string }
  description: string
  choice: ToolChoice
  onChange: (next: ToolChoice) => void
}): React.JSX.Element {
  return (
    <div {...dataAttributes} className="rounded-lg border border-border/60 bg-card/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <Label className="text-sm">{spec.name}</Label>
            <a
              href={spec.homepage}
              target="_blank"
              rel="noreferrer"
              aria-label={translate('languageServers.docs', 'Open {{server}} docs', {
                server: spec.name
              })}
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <SettingsSwitch
          checked={choice.enabled}
          ariaLabel={spec.name}
          onChange={() => onChange({ ...choice, enabled: !choice.enabled })}
        />
      </div>
      {choice.enabled ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <CommandField
            command={choice.command}
            defaultCommand={spec.command}
            onCommit={(command) => onChange({ ...choice, command })}
          />
        </div>
      ) : null}
    </div>
  )
}

// Fork: one card per language in the registry (`shared/language-server.ts`), per linter
// (`shared/linter.ts`) and per formatter (`shared/formatter.ts`), so a new one shows up here
// without touching this pane.
export function LanguageServersPane({ settings, updateSettings }: Props): React.JSX.Element {
  const searchEntries = getLanguageServersSearchEntries()
  const save = (
    language: LanguageServerLanguage,
    { enabled, server, command, diagnostics, completions, quickFixes, organizeImports }: Choice
  ): void =>
    updateSettings({
      languageServers: {
        ...settings.languageServers,
        [language]: {
          enabled,
          server,
          ...(command ? { command } : {}),
          ...(diagnostics ? {} : { diagnostics: false }),
          ...(completions ? {} : { completions: false }),
          ...(quickFixes ? {} : { quickFixes: false }),
          ...(organizeImports ? {} : { organizeImports: false })
        }
      }
    })
  const saveLinter = (linter: LinterId, { enabled, command }: ToolChoice): void =>
    updateSettings({
      linters: { ...settings.linters, [linter]: { enabled, ...(command ? { command } : {}) } }
    })
  const saveFormatter = (formatter: FormatterId, { enabled, command }: ToolChoice): void =>
    updateSettings({
      formatters: {
        ...settings.formatters,
        [formatter]: { enabled, ...(command ? { command } : {}) }
      }
    })
  return (
    <div className="space-y-3">
      {LANGUAGE_SERVER_LANGUAGES.map((language, index) => (
        <SearchableSetting key={language} {...searchEntries[index]}>
          <LanguageServerCard
            language={language}
            choice={languageServerSettings(settings, language)}
            onChange={(next) => save(language, next)}
          />
        </SearchableSetting>
      ))}
      {LINTER_IDS.map((linter, index) => (
        <SearchableSetting
          key={linter}
          {...searchEntries[LANGUAGE_SERVER_LANGUAGES.length + index]}
        >
          <ToolCard
            dataAttributes={{ 'data-linter': linter }}
            spec={LINTERS[linter]}
            description={RENDERER_LINTERS[linter].description()}
            choice={linterSettings(settings, linter)}
            onChange={(next) => saveLinter(linter, next)}
          />
        </SearchableSetting>
      ))}
      {FORMATTER_IDS.map((formatter, index) => (
        <SearchableSetting
          key={formatter}
          {...searchEntries[LANGUAGE_SERVER_LANGUAGES.length + LINTER_IDS.length + index]}
        >
          <ToolCard
            dataAttributes={{ 'data-formatter': formatter }}
            spec={FORMATTERS[formatter]}
            description={RENDERER_FORMATTERS[formatter].description()}
            choice={formatterSettings(settings, formatter)}
            onChange={(next) => saveFormatter(formatter, next)}
          />
        </SearchableSetting>
      ))}
    </div>
  )
}
