export type LanguageServerOption = {
  name: string
  command: string
  args: readonly string[]
  homepage: string
}

type LanguageServerSpec = {
  /** A material-icon-theme icon name, the same set the file tree uses. */
  icon: string
  monacoLanguageIds: readonly string[]
  lspLanguageIdByExtension: Readonly<Record<string, string>>
  servers: Readonly<Record<string, LanguageServerOption>>
  defaultServer: string
}

// Fork: the one list of languages Orca runs a language server for, and the servers each can use.
// Main adds where a language's project and tools live (`language-server-launchers.ts`), the
// renderer adds its settings text and fallback (`language-server-languages.ts`); both are keyed by
// this list, so a new entry fails typecheck until it has them.
export const LANGUAGE_SERVERS = {
  python: {
    icon: 'python',
    monacoLanguageIds: ['python'],
    lspLanguageIdByExtension: { py: 'python', pyi: 'python' },
    servers: {
      pyrefly: {
        name: 'pyrefly',
        command: 'pyrefly',
        args: ['lsp'],
        homepage: 'https://pyrefly.org'
      },
      pyright: {
        name: 'Pyright',
        command: 'pyright-langserver',
        args: ['--stdio'],
        homepage: 'https://microsoft.github.io/pyright'
      },
      basedpyright: {
        name: 'basedpyright',
        command: 'basedpyright-langserver',
        args: ['--stdio'],
        homepage: 'https://docs.basedpyright.com'
      },
      ty: {
        name: 'ty',
        command: 'ty',
        args: ['server'],
        homepage: 'https://docs.astral.sh/ty'
      }
    },
    defaultServer: 'pyrefly'
  },
  typescript: {
    icon: 'typescript',
    monacoLanguageIds: ['typescript', 'javascript'],
    lspLanguageIdByExtension: {
      ts: 'typescript',
      mts: 'typescript',
      cts: 'typescript',
      tsx: 'typescriptreact',
      js: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      jsx: 'javascriptreact'
    },
    servers: {
      tsgo: {
        name: 'tsgo',
        command: 'tsgo',
        args: ['--lsp', '--stdio'],
        homepage: 'https://github.com/microsoft/typescript-go'
      },
      'typescript-language-server': {
        name: 'typescript-language-server',
        command: 'typescript-language-server',
        args: ['--stdio'],
        homepage: 'https://github.com/typescript-language-server/typescript-language-server'
      }
    },
    defaultServer: 'tsgo'
  }
} as const satisfies Record<string, LanguageServerSpec>

export type LanguageServerLanguage = keyof typeof LANGUAGE_SERVERS

export const LANGUAGE_SERVER_LANGUAGES = Object.keys(LANGUAGE_SERVERS) as LanguageServerLanguage[]

export type LanguageServerSettingsValue =
  | boolean
  | {
      enabled?: boolean
      server?: string
      command?: string
      diagnostics?: boolean
      completions?: boolean
    }

export type LanguageServerSettingsMap = Partial<
  Record<LanguageServerLanguage, LanguageServerSettingsValue>
>

export function languageServerOptions(
  language: LanguageServerLanguage
): Readonly<Record<string, LanguageServerOption>> {
  return LANGUAGE_SERVERS[language].servers
}

// Why a boolean too: the first version of this setting stored only on/off per language.
export function languageServerSettings(
  settings: { languageServers?: LanguageServerSettingsMap } | null,
  language: LanguageServerLanguage
): {
  enabled: boolean
  server: string
  command: string | null
  diagnostics: boolean
  completions: boolean
} {
  const value = settings?.languageServers?.[language]
  const stored = typeof value === 'object' && value !== null ? value : {}
  const { defaultServer } = LANGUAGE_SERVERS[language]
  const server =
    stored.server && Object.hasOwn(languageServerOptions(language), stored.server)
      ? stored.server
      : defaultServer
  return {
    enabled: typeof value === 'boolean' ? value : stored.enabled !== false,
    server,
    command: stored.command?.trim() || null,
    diagnostics: stored.diagnostics !== false,
    completions: stored.completions !== false
  }
}

function fileExtension(filePath: string): string | null {
  const name = filePath.slice(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null
}

export function languageServerForFile(
  filePath: string
): { language: LanguageServerLanguage; lspLanguageId: string } | null {
  const extension = fileExtension(filePath)
  for (const language of LANGUAGE_SERVER_LANGUAGES) {
    const byExtension: Readonly<Record<string, string>> =
      LANGUAGE_SERVERS[language].lspLanguageIdByExtension
    const lspLanguageId = extension ? byExtension[extension] : undefined
    if (lspLanguageId) {
      return { language, lspLanguageId }
    }
  }
  return null
}

export function languageServerForMonacoLanguage(
  monacoLanguageId: string
): LanguageServerLanguage | null {
  return (
    LANGUAGE_SERVER_LANGUAGES.find((language) =>
      (LANGUAGE_SERVERS[language].monacoLanguageIds as readonly string[]).includes(monacoLanguageId)
    ) ?? null
  )
}

/** Zero-based, as the language server reports it. `preview` is the target's first lines. */
export type LanguageServerLocation = {
  filePath: string
  line: number
  character: number
  preview?: string
}

export type LanguageServerRequest = {
  language: LanguageServerLanguage
  /** A key of the language's `servers`; anything else runs its default. */
  server: string
  /** A path that overrides where the chosen server is looked up. */
  command: string | null
  filePath: string
  worktreeRoot: string
  /** The repo's main checkout; its venv or node_modules cover worktrees that have none. */
  repoRoot: string | null
  /** Python only: the repo's venv setting. */
  venvSetting: string | null
  text: string
  line: number
  character: number
}

/** An editor's file, without a position: what the server checks for errors. */
export type LanguageServerDocument = Omit<LanguageServerRequest, 'line' | 'character'>

export type LanguageServerHoverResult =
  | { ok: true; markdown: string | null }
  | { ok: false; error: string }

export type LanguageServerDefinitionResult =
  | { ok: true; locations: LanguageServerLocation[] }
  | { ok: false; error: string }

/** `files` holds the text of each referenced file other than the asking one. */
export type LanguageServerReferencesResult =
  | { ok: true; locations: LanguageServerLocation[]; files: Record<string, string> }
  | { ok: false; error: string }

/** Zero-based, as the language server reports it. `kind` is LSP's CompletionItemKind. */
export type LanguageServerCompletionItem = {
  label: string
  kind?: number
  detail?: string
  documentation?: string
  sortText?: string
  filterText?: string
  insertText: string
  /** The insert text is an LSP snippet, with `$1` tab stops. */
  snippet?: true
  /** What the insert text replaces; the word at the cursor when absent. */
  range?: { line: number; character: number; endLine: number; endCharacter: number }
}

/** `incomplete`: the server narrowed the list, so typing on asks again instead of filtering. */
export type LanguageServerCompletions = {
  incomplete: boolean
  items: LanguageServerCompletionItem[]
}

export type LanguageServerCompletionRequest = LanguageServerRequest & {
  /** The character that opened the list, like `.`; absent when it was typed or asked for. */
  triggerCharacter?: string
}

export type LanguageServerCompletionResult =
  | ({ ok: true } & LanguageServerCompletions)
  | { ok: false; error: string }

export function isLanguageServerLanguage(value: unknown): value is LanguageServerLanguage {
  return LANGUAGE_SERVER_LANGUAGES.some((language) => language === value)
}
