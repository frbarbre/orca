import { LANGUAGE_SERVERS, type LanguageServerTextEdit } from './language-server'

type FormatterSpec = {
  name: string
  command: string
  args: readonly string[]
  /** The formatter runs only for a file under one of these, so a project without it is left as is. */
  configFiles: readonly string[]
  /** A pyproject.toml counts as config only when it holds this table. */
  pyprojectTable?: string
  extensions: readonly string[]
  homepage: string
}

// Fork: the formatters Mod+S runs before saving, each through its own LSP server.
export const FORMATTERS = {
  oxfmt: {
    name: 'oxfmt',
    command: 'oxfmt',
    args: ['--lsp'],
    configFiles: ['.oxfmtrc.json', '.oxfmtrc.jsonc', 'oxfmt.config.ts'],
    extensions: [
      ...Object.keys(LANGUAGE_SERVERS.typescript.lspLanguageIdByExtension),
      'json',
      'jsonc',
      'json5',
      'css',
      'scss',
      'less',
      'md',
      'mdx',
      'yaml',
      'yml'
    ],
    homepage: 'https://oxc.rs/docs/guide/usage/formatter'
  },
  ruff: {
    name: 'Ruff',
    command: 'ruff',
    args: ['server'],
    configFiles: ['ruff.toml', '.ruff.toml'],
    pyprojectTable: '[tool.ruff',
    extensions: ['py', 'pyi'],
    homepage: 'https://docs.astral.sh/ruff/formatter'
  }
} as const satisfies Record<string, FormatterSpec>

export type FormatterId = keyof typeof FORMATTERS

export const FORMATTER_IDS = Object.keys(FORMATTERS) as FormatterId[]

export type FormatterSettingsMap = Partial<
  Record<FormatterId, { enabled?: boolean; command?: string }>
>

export type FormatEdit = LanguageServerTextEdit

export type FormatDocumentRequest = {
  filePath: string
  text: string
  tabSize: number
  insertSpaces: boolean
}

export type FormatRequest = FormatDocumentRequest & {
  formatter: FormatterId
  /** A path that overrides where the formatter is looked up. */
  command: string | null
  worktreeRoot: string
  /** The repo's main checkout, whose node_modules or venv a fresh worktree can borrow. */
  repoRoot: string | null
  venvSetting: string | null
}

export type FormatResult = { ok: true; edits: FormatEdit[] } | { ok: false; error: string }

export type FormatterApi = {
  format: (args: FormatRequest) => Promise<FormatResult>
  stop: (args: { formatter: FormatterId }) => Promise<void>
}

export function formatterSettings(
  settings: { formatters?: FormatterSettingsMap } | null,
  formatter: FormatterId
): { enabled: boolean; command: string | null } {
  const stored = settings?.formatters?.[formatter] ?? {}
  return { enabled: stored.enabled !== false, command: stored.command?.trim() || null }
}

export function isFormatterId(value: unknown): value is FormatterId {
  return FORMATTER_IDS.some((formatter) => formatter === value)
}

export function formatterForFile(filePath: string): FormatterId | null {
  const name = filePath.slice(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : null
  return (
    FORMATTER_IDS.find((formatter) =>
      (FORMATTERS[formatter].extensions as readonly string[]).includes(extension ?? '')
    ) ?? null
  )
}
