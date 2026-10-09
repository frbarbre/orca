/** Zero-based, as the language server reports it. */
export type PythonDefinitionLocation = { filePath: string; line: number; character: number }

export type PythonDefinitionRequest = {
  filePath: string
  worktreeRoot: string
  /** The repo's main checkout; its venv covers worktrees that have none. */
  repoRoot: string | null
  venvSetting: string | null
  text: string
  line: number
  character: number
}

export type PythonHoverResult = { ok: true; markdown: string | null } | { ok: false; error: string }

export type PythonDefinitionResult =
  | { ok: true; locations: PythonDefinitionLocation[] }
  | { ok: false; error: string }
