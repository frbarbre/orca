// Fork: tells a change that only moves, adds or drops imports from one that touches code, so the
// Changes list can file it under "Imports only".

type Language = 'script' | 'python'

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, Language>> = {
  ts: 'script',
  tsx: 'script',
  mts: 'script',
  cts: 'script',
  js: 'script',
  jsx: 'script',
  mjs: 'script',
  cjs: 'script',
  py: 'python',
  pyi: 'python'
}

const MODULE_SOURCE_END = /(?:from\s*|^\s*import\s*)['"][^'"]+['"]\s*;?\s*$/
const SCRIPT_IMPORT_START = /^\s*import(?:\s|\{|\*|['"])/
const SCRIPT_REEXPORT_START = /^\s*export\s+(?:type\s+)?(?:\*|\{)/
const PYTHON_IMPORT_START = /^\s*(?:import\s+\S|from\s+\S+\s+import\b)/

function languageOf(path: string): Language | null {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return LANGUAGE_BY_EXTENSION[extension] ?? null
}

/** Where the statement starting at `start` ends (inclusive), or null when it is not an import. */
function scriptImportEnd(lines: readonly string[], start: number): number | null {
  const first = lines[start]
  const reexport = SCRIPT_REEXPORT_START.test(first)
  if (!reexport && !SCRIPT_IMPORT_START.test(first)) {
    return null
  }
  for (let index = start; index < lines.length; index++) {
    if (MODULE_SOURCE_END.test(lines[index])) {
      return index
    }
    // Why: `export { a }` without `from` exports local names, which is code, not an import.
    if (reexport && lines[index].includes('}') && !/\bfrom\b/.test(lines[index])) {
      return null
    }
  }
  return null
}

function pythonImportEnd(lines: readonly string[], start: number): number | null {
  if (!PYTHON_IMPORT_START.test(lines[start])) {
    return null
  }
  let index = start
  if (lines[index].includes('(') && !lines[index].includes(')')) {
    while (index < lines.length - 1 && !lines[index].includes(')')) {
      index++
    }
    return index
  }
  while (index < lines.length - 1 && lines[index].trimEnd().endsWith('\\')) {
    index++
  }
  return index
}

function splitImports(text: string, language: Language): { imports: string[]; code: string[] } {
  const lines = text.split(/\r?\n/)
  const imports: string[] = []
  const code: string[] = []
  const importEnd = language === 'python' ? pythonImportEnd : scriptImportEnd
  for (let index = 0; index < lines.length; index++) {
    const end = importEnd(lines, index)
    if (end === null) {
      if (lines[index].trim()) {
        code.push(lines[index])
      }
      continue
    }
    const statement = lines.slice(index, end + 1).join(' ')
    imports.push(statement.replace(/\s+/g, ' ').trim())
    index = end
  }
  return { imports: imports.sort(), code }
}

/** True when the two versions differ in their import statements and nowhere else but blank lines. */
export function isImportOnlyChange(path: string, before: string, after: string): boolean {
  const language = languageOf(path)
  if (!language) {
    return false
  }
  const old = splitImports(before, language)
  const next = splitImports(after, language)
  const same = (a: readonly string[], b: readonly string[]): boolean =>
    a.length === b.length && a.every((line, index) => line === b[index])
  return same(old.code, next.code) && !same(old.imports, next.imports)
}
