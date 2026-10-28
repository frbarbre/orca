import { LANGUAGE_SERVERS } from './language-server'

type LinterSpec = {
  name: string
  command: string
  args: readonly string[]
  /** The linter runs only for a file under one of these, so a project without it gets nothing. */
  configFiles: readonly string[]
  lspLanguageIdByExtension: Readonly<Record<string, string>>
  homepage: string
}

// Fork: the linters Orca runs next to the language servers, each through its own `--lsp` server.
export const LINTERS = {
  oxlint: {
    name: 'oxlint',
    command: 'oxlint',
    args: ['--lsp'],
    configFiles: ['.oxlintrc.json', 'oxlint.config.ts'],
    lspLanguageIdByExtension: LANGUAGE_SERVERS.typescript.lspLanguageIdByExtension,
    homepage: 'https://oxc.rs/docs/guide/usage/linter'
  }
} as const satisfies Record<string, LinterSpec>

export type LinterId = keyof typeof LINTERS

export const LINTER_IDS = Object.keys(LINTERS) as LinterId[]

export type LinterSettingsMap = Partial<Record<LinterId, { enabled?: boolean; command?: string }>>

export function linterSettings(
  settings: { linters?: LinterSettingsMap } | null,
  linter: LinterId
): { enabled: boolean; command: string | null } {
  const stored = settings?.linters?.[linter] ?? {}
  return { enabled: stored.enabled !== false, command: stored.command?.trim() || null }
}

export function isLinterId(value: unknown): value is LinterId {
  return LINTER_IDS.some((linter) => linter === value)
}

function fileExtension(filePath: string): string | null {
  const name = filePath.slice(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null
}

export function lintersForFile(filePath: string): LinterId[] {
  const extension = fileExtension(filePath)
  return extension
    ? LINTER_IDS.filter((linter) =>
        Object.hasOwn(LINTERS[linter].lspLanguageIdByExtension, extension)
      )
    : []
}

export type LintRequest = {
  linter: LinterId
  /** A path that overrides where the linter is looked up. */
  command: string | null
  filePath: string
  worktreeRoot: string
  /** The repo's main checkout, whose node_modules a fresh worktree can borrow. */
  repoRoot: string | null
  text: string
}
