import { parseCiTriageConfig } from './ci-triage'
import { normalizeJiraProjectReference } from './jira/jira-project-reference'
import type { RepoHookSettings } from './orca-yaml-hook-types'
import type { ExternalWorktreeVisibility, IssueSourcePreference, Repo } from './repo-types'
import { normalizeRepoSourceControlAiOverrides } from './source-control-ai-repo-settings'
import { normalizeWorktreeVisibilitySourcePreferences } from './worktree/visibility-sources'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneOf<T extends string>(values: readonly T[]): (value: unknown) => T | undefined {
  return (value) => values.find((entry) => entry === value)
}

function parseString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

// Why: an absolute path or one climbing out of the checkout points at this machine's disk.
function isPortableRelativePath(value: string): boolean {
  return !/^([a-zA-Z]:|[\\/]|~)/.test(value) && !value.split(/[\\/]/).includes('..')
}

function parseRelativePath(value: unknown): string | undefined {
  const path = parseString(value)
  return path && isPortableRelativePath(path) ? path : undefined
}

function parseRelativePaths(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const path = parseRelativePath(entry)
        return path ? [path] : []
      })
    : undefined
}

const parseVisibility = oneOf<ExternalWorktreeVisibility>(['hide', 'show'])

function parseHookSettings(value: unknown): RepoHookSettings | undefined {
  if (!isRecord(value) || !isRecord(value.scripts)) {
    return undefined
  }
  const setupRunPolicy = oneOf(['ask', 'run-by-default', 'skip-by-default'] as const)(
    value.setupRunPolicy
  )
  const setupAgentStartupPolicy = oneOf(['start-immediately', 'wait-for-setup'] as const)(
    value.setupAgentStartupPolicy
  )
  const commandSourcePolicy = oneOf(['shared-only', 'local-only', 'run-both'] as const)(
    value.commandSourcePolicy
  )
  return {
    mode: value.mode === 'override' ? 'override' : 'auto',
    ...(setupRunPolicy ? { setupRunPolicy } : {}),
    ...(setupAgentStartupPolicy ? { setupAgentStartupPolicy } : {}),
    ...(commandSourcePolicy ? { commandSourcePolicy } : {}),
    scripts: {
      setup: typeof value.scripts.setup === 'string' ? value.scripts.setup : '',
      archive: typeof value.scripts.archive === 'string' ? value.scripts.archive : ''
    }
  }
}

// Why every Repo field is listed: a new one fails typecheck until someone decides whether it
// travels in a settings export. A parser exports the field (and checks it again on import); null
// keeps it on this machine because it names this machine's paths, hosts, accounts or bookkeeping.
const REPO_FIELDS = {
  id: null,
  path: null,
  displayName: null,
  badgeColor: null,
  repoIcon: null,
  upstream: null,
  addedAt: null,
  kind: null,
  folderUpgradeGitRootPath: null,
  gitUsername: null,
  worktreeBaseRef: parseString,
  worktreeBasePath: null,
  hookSettings: parseHookSettings,
  connectionId: null,
  executionHostId: null,
  issueSourcePreference: oneOf<IssueSourcePreference>(['upstream', 'origin', 'auto']),
  defaultJiraProject: (value: unknown) => normalizeJiraProjectReference(value) ?? undefined,
  ghAccount: null,
  forkSyncMode: oneOf(['ask', 'safe-auto', 'off'] as const),
  gitRemoteIdentity: null,
  externalWorktreeVisibility: parseVisibility,
  externalWorktreeVisibilityLegacy: null,
  externalWorktreeVisibilityPromptDismissedAt: null,
  externalWorktreeInboxBaselinePaths: null,
  importedExternalWorktreePaths: null,
  agentWorktreeVisibility: parseVisibility,
  customWorktreeVisibilitySources: null,
  // Why only the built-in sources: custom ones are keyed by this machine's source roots.
  worktreeVisibilitySourcePreferences: (value: unknown) => {
    const builtIn = normalizeWorktreeVisibilitySourcePreferences(value)?.builtIn
    return builtIn && Object.keys(builtIn).length > 0 ? { builtIn } : undefined
  },
  externalWorktreeDiscoverySuppressedAt: null,
  symlinkPaths: parseRelativePaths,
  pythonVenvPath: parseRelativePath,
  portLabelsCommand: parseString,
  ciTriage: (value: unknown) => parseCiTriageConfig(value) ?? undefined,
  projectGroupId: null,
  projectGroupOrder: null,
  sourceControlAi: normalizeRepoSourceControlAiOverrides,
  projectHostSetupMethod: null,
  orcadRetained: null
} satisfies { [K in keyof Repo]-?: ((value: unknown) => Repo[K] | undefined) | null }

type PortableRepoField = {
  [K in keyof typeof REPO_FIELDS]: (typeof REPO_FIELDS)[K] extends null ? never : K
}[keyof typeof REPO_FIELDS]

export type PortableRepoSettings = Partial<Pick<Repo, PortableRepoField>>

/** A project's settings, matched to the importer's projects by git remote, never by local id. */
export type ProjectSettingsTransfer = {
  remote: string
  name: string
  settings: PortableRepoSettings
}

function pickPortableRepoSettings(source: Record<string, unknown>): PortableRepoSettings {
  const picked: Record<string, unknown> = {}
  for (const [key, parse] of Object.entries(REPO_FIELDS)) {
    const value = parse?.(source[key])
    if (value !== undefined) {
      picked[key] = value
    }
  }
  // SAFETY: each key is a portable Repo field and its value came from that field's own parser.
  return picked as PortableRepoSettings
}

// Why folder workspaces and unresolved remotes are skipped: without a remote nothing ties the
// project to the same project on another machine.
export function pickPortableProjects(repos: readonly Repo[]): ProjectSettingsTransfer[] {
  const projects = new Map<string, ProjectSettingsTransfer>()
  for (const repo of repos) {
    const remote = repo.gitRemoteIdentity?.canonicalKey
    if (!remote || projects.has(remote)) {
      continue
    }
    const settings = pickPortableRepoSettings(Object.fromEntries(Object.entries(repo)))
    if (Object.keys(settings).length > 0) {
      projects.set(remote, { remote, name: repo.displayName, settings })
    }
  }
  return [...projects.values()]
}

export function parsePortableProjects(value: unknown): ProjectSettingsTransfer[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.remote !== 'string' || !isRecord(entry.settings)) {
      return []
    }
    const settings = pickPortableRepoSettings(entry.settings)
    return Object.keys(settings).length > 0
      ? [{ remote: entry.remote, name: typeof entry.name === 'string' ? entry.name : '', settings }]
      : []
  })
}

export function findReposForProject(
  repos: readonly Repo[],
  project: ProjectSettingsTransfer
): Repo[] {
  return repos.filter((repo) => repo.gitRemoteIdentity?.canonicalKey === project.remote)
}
