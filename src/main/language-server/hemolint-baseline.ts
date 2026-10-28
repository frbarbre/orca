import { dirname, join, relative, sep } from 'node:path'
import type { EditorDiagnostic } from '../../shared/editor-diagnostics'
import { directoriesUpTo } from './typescript-project-resolution'

function readCounts(json: string | null): Map<string, number> {
  try {
    const parsed: unknown = json ? JSON.parse(json) : null
    return new Map(
      parsed && typeof parsed === 'object'
        ? Object.entries(parsed).filter(
            (entry): entry is [string, number] => typeof entry[1] === 'number'
          )
        : []
    )
  } catch {
    return new Map()
  }
}

// Fork: hemolint keeps the findings a project's CI already accepts under
// `.hemolint/<tool>-<rule>/<path>.json`, as each offending line's trimmed text and how often it
// occurs; the editor hides the same ones so its squiggles match what CI fails on.
export function createHemolintFilter({
  exists,
  readFile
}: {
  exists: (path: string) => boolean
  readFile: (path: string) => string | null
}): (args: {
  tool: string
  filePath: string
  worktreeRoot: string
  text: string
  diagnostics: EditorDiagnostic[]
}) => EditorDiagnostic[] {
  return ({ tool, filePath, worktreeRoot, text, diagnostics }) => {
    const root = directoriesUpTo(dirname(filePath), worktreeRoot).find((dir) =>
      exists(join(dir, '.hemolint'))
    )
    if (!root) {
      return diagnostics
    }
    const path = relative(root, filePath).split(sep).join('/')
    const lines = text.split(/\r?\n/)
    const budgets = new Map<string, Map<string, number>>()
    const budgetFor = (code: string): Map<string, number> => {
      let budget = budgets.get(code)
      if (!budget) {
        budget = readCounts(readFile(join(root, '.hemolint', `${tool}-${code}`, `${path}.json`)))
        budgets.set(code, budget)
      }
      return budget
    }
    return diagnostics.filter((diagnostic) => {
      const line = lines[diagnostic.line]?.trim()
      if (!diagnostic.code || line === undefined) {
        return true
      }
      const budget = budgetFor(diagnostic.code)
      const left = budget.get(line) ?? 0
      if (left > 0) {
        budget.set(line, left - 1)
        return false
      }
      return true
    })
  }
}
