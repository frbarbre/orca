import type { GlobalSettings } from './global-settings-types'
import type { PersistedUIState } from './persisted-ui-state-types'
import type { Repo } from './repo-types'
import {
  parsePortableProjects,
  pickPortableProjects,
  type ProjectSettingsTransfer
} from './settings-transfer-projects'
import { UI_STATE_EXPORT } from './settings-transfer-ui-fields'
import type { WorkspaceStatusRuleConfig } from './workspace-status-rule-config'

export type SettingsSource = GlobalSettings | Record<string, unknown>
export type UiSource = PersistedUIState | Record<string, unknown>

export const SETTINGS_TRANSFER_FORMAT = 'orca-settings'
export const SETTINGS_TRANSFER_VERSION = 1

export const EDITOR_THEME_FILE_NAMES = ['editor-dark.json', 'editor-light.json'] as const
export type EditorThemeFileName = (typeof EDITOR_THEME_FILE_NAMES)[number]

export type SettingsTransferFiles = {
  keybindings: string | null
  editorThemes: Partial<Record<EditorThemeFileName, string>>
}

export type SettingsTransferBundle = SettingsTransferFiles & {
  format: typeof SETTINGS_TRANSFER_FORMAT
  version: typeof SETTINGS_TRANSFER_VERSION
  exportedAt: string
  settings: Record<string, unknown>
  ui: Record<string, unknown>
  projects: ProjectSettingsTransfer[]
}

// Why a denylist backed by name patterns: a new setting that holds a credential or a local path
// usually says so in its name, so it stays out without anyone remembering to list it here.
const PRIVATE_SETTING_PATTERNS = [
  /account/i,
  /token/i,
  /cookie/i,
  /apikey/i,
  /secret/i,
  /password/i,
  /path/i,
  /cwd/i,
  /machine/i,
  /proxy/i,
  /runtime/i,
  /wsl/i,
  /udid/i,
  /telemetry/i,
  /pairing/i,
  /consent/i,
  /endpoint/i,
  /groupid/i,
  /workspaceid/i,
  /environment/i,
  /shell/i,
  /migrated/i,
  /migration/i,
  /defaulted/i,
  /seed/i,
  /prompted/i,
  /dismissed/i,
  /dir$/i,
  /dirhistory/i,
  /device/i,
  /repoid/i,
  /hostid/i,
  /authority/i,
  /deliverygate/i,
  /parking/i,
  /retentionbudget/i,
  /http1/i
]

const PRIVATE_SETTING_KEYS = new Set([
  'agentCmdOverrides',
  'agentDefaultEnv',
  'githubProjects',
  'defaultRepoSelection',
  'defaultLinearTeamSelection',
  'openInApplications',
  'devPluginPaths',
  'disabledPlugins',
  'minimaxUsageModels'
])

const PORTABLE_UI_KEYS = Object.entries(UI_STATE_EXPORT).flatMap(([key, portable]) =>
  portable ? [key] : []
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPortableSettingKey(key: string): boolean {
  return !PRIVATE_SETTING_KEYS.has(key) && !PRIVATE_SETTING_PATTERNS.some((re) => re.test(key))
}

// Why nested too: a portable setting can still carry a private field, like a sound file's path.
function scrubPrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubPrivateFields)
  }
  if (!isRecord(value)) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => isPortableSettingKey(key))
      .map(([key, entry]) => [key, scrubPrivateFields(entry)])
  )
}

// Why a remote replaces the repo id: the id is this machine's, the git remote finds the same
// project on another one. A project without a remote has nothing to match, so its commands stay home.
function toPortableQuickCommand(command: unknown, repos: readonly Repo[]): unknown[] {
  if (!(isRecord(command) && isRecord(command.scope) && 'repoId' in command.scope)) {
    return [command]
  }
  const { repoId } = command.scope
  const remote = repos.find((repo) => repo.id === repoId)?.gitRemoteIdentity?.canonicalKey
  return remote ? [{ ...command, scope: { type: 'project', remote } }] : []
}

export function pickPortableSettings(
  settings: SettingsSource,
  repos: readonly Repo[] = []
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (!isPortableSettingKey(key)) {
      continue
    }
    picked[key] =
      key === 'terminalQuickCommands' && Array.isArray(value)
        ? value
            .flatMap((command) => toPortableQuickCommand(command, repos))
            .map(scrubPrivateFields)
        : scrubPrivateFields(value)
  }
  return picked
}

export function resolveImportedQuickCommands(
  commands: unknown,
  repos: readonly Repo[]
): unknown[] {
  if (!Array.isArray(commands)) {
    return []
  }
  return commands.flatMap((command) => {
    if (!(isRecord(command) && isRecord(command.scope) && command.scope.type === 'project')) {
      return [command]
    }
    const remote = command.scope.remote
    const repo = repos.find((entry) => entry.gitRemoteIdentity?.canonicalKey === remote)
    return repo ? [{ ...command, scope: { type: 'repo', repoId: repo.id } }] : []
  })
}

// Why these go: project ids, the handled-PR ledger and the "since" timestamp describe this machine's
// workspaces and would make the rules act on, or skip, the wrong pull requests elsewhere.
const LOCAL_STATUS_RULE_KEYS = new Set([
  'repoIds',
  'handledPullRequests',
  'ledgerVersion',
  'newWorkspaceStatusSince'
])

function pickPortableStatusRules(rules: unknown): Record<string, unknown> | null {
  if (!isRecord(rules)) {
    return null
  }
  return Object.fromEntries(
    Object.entries(rules).filter(([key]) => !LOCAL_STATUS_RULE_KEYS.has(key))
  )
}

export function pickPortableUi(ui: UiSource): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  const source = Object.fromEntries(Object.entries(ui))
  for (const key of PORTABLE_UI_KEYS) {
    if (!(key in source)) {
      continue
    }
    if (key === 'workspaceStatusRules') {
      const rules = pickPortableStatusRules(source[key])
      if (rules) {
        picked[key] = rules
      }
      continue
    }
    picked[key] = source[key]
  }
  return picked
}

export function buildSettingsTransferBundle(input: {
  settings: SettingsSource
  ui: UiSource
  repos: readonly Repo[]
  files: SettingsTransferFiles
  now?: Date
}): SettingsTransferBundle {
  return {
    format: SETTINGS_TRANSFER_FORMAT,
    version: SETTINGS_TRANSFER_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    settings: pickPortableSettings(input.settings, input.repos),
    ui: pickPortableUi(input.ui),
    projects: pickPortableProjects(input.repos),
    keybindings: input.files.keybindings,
    editorThemes: input.files.editorThemes
  }
}

function parseEditorThemes(value: unknown): Partial<Record<EditorThemeFileName, string>> {
  if (!isRecord(value)) {
    return {}
  }
  const themes: Partial<Record<EditorThemeFileName, string>> = {}
  for (const name of EDITOR_THEME_FILE_NAMES) {
    const theme = value[name]
    if (typeof theme === 'string') {
      themes[name] = theme
    }
  }
  return themes
}

export type ParsedSettingsTransfer =
  | { ok: true; bundle: SettingsTransferBundle }
  | { ok: false; error: string }

// Why filtered again on the way in: the file may have been edited, and an import must never be a
// way to plant a token, a path or another machine's project ids.
export function parseSettingsTransfer(text: string): ParsedSettingsTransfer {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' }
  }
  if (!isRecord(raw) || raw.format !== SETTINGS_TRANSFER_FORMAT) {
    return { ok: false, error: 'The file is not an Orca settings export.' }
  }
  if (raw.version !== SETTINGS_TRANSFER_VERSION) {
    return { ok: false, error: 'The file comes from a newer Orca; update Orca and try again.' }
  }
  return {
    ok: true,
    bundle: {
      format: SETTINGS_TRANSFER_FORMAT,
      version: SETTINGS_TRANSFER_VERSION,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      settings: isRecord(raw.settings) ? pickPortableSettings(raw.settings) : {},
      ui: isRecord(raw.ui) ? pickPortableUi(raw.ui) : {},
      projects: parsePortableProjects(raw.projects),
      keybindings: typeof raw.keybindings === 'string' ? raw.keybindings : null,
      editorThemes: parseEditorThemes(raw.editorThemes)
    }
  }
}

// Why deep: exports drop private nested fields, so a shallow write would erase the importer's own
// ones (their sound file, their models folder). Arrays are replaced whole.
function mergeNested(existing: unknown, value: unknown): unknown {
  if (!isRecord(value) || !isRecord(existing)) {
    return value
  }
  const merged: Record<string, unknown> = { ...existing }
  for (const [key, entry] of Object.entries(value)) {
    merged[key] = mergeNested(existing[key], entry)
  }
  return merged
}

export function mergeImportedSettings(
  current: SettingsSource,
  imported: Record<string, unknown>
): Record<string, unknown> {
  const base = Object.fromEntries(Object.entries(current))
  return Object.fromEntries(
    Object.entries(imported).map(([key, value]) => [key, mergeNested(base[key], value)])
  )
}

// Why the local fields win: they are this machine's projects and ledger, which the export left out.
// The result is sanitized like any stored value when Orca loads it.
export function mergeImportedStatusRules(
  current: WorkspaceStatusRuleConfig,
  imported: Record<string, unknown>,
  now: number
): Record<string, unknown> {
  return {
    ...current,
    ...imported,
    repoIds: current.repoIds,
    handledPullRequests: current.handledPullRequests,
    ledgerVersion: current.ledgerVersion,
    // Why now: an imported "new workspace" column must only move workspaces created after it.
    newWorkspaceStatusSince: imported.newWorkspaceStatus ? now : current.newWorkspaceStatusSince
  }
}
