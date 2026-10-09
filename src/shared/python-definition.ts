/** Zero-based, as the language server reports it. */
export type PythonDefinitionLocation = { filePath: string; line: number; character: number }

export type PythonDefinitionRequest = {
  filePath: string
  worktreeRoot: string
  venvSetting: string | null
  text: string
  line: number
  character: number
}

export type PythonDefinitionResult =
  | { ok: true; locations: PythonDefinitionLocation[] }
  | { ok: false; error: string }
