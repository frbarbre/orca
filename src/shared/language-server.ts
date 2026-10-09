export const LANGUAGE_SERVER_LANGUAGES = ['python', 'typescript'] as const

export type LanguageServerLanguage = (typeof LANGUAGE_SERVER_LANGUAGES)[number]

/** Zero-based, as the language server reports it. `preview` is the target's first lines. */
export type LanguageServerLocation = {
  filePath: string
  line: number
  character: number
  preview?: string
}

export type LanguageServerRequest = {
  language: LanguageServerLanguage
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

export type LanguageServerHoverResult =
  | { ok: true; markdown: string | null }
  | { ok: false; error: string }

export type LanguageServerDefinitionResult =
  | { ok: true; locations: LanguageServerLocation[] }
  | { ok: false; error: string }

export function isLanguageServerLanguage(value: unknown): value is LanguageServerLanguage {
  return LANGUAGE_SERVER_LANGUAGES.some((language) => language === value)
}
