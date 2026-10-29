import type { LanguageServerLocation } from '../../shared/language-server'

const MAX_REFERENCE_FILES = 50

// Why the texts: the peek view shows each reference in its file, and the renderer only holds the
// files that are open.
export function referencedFileTexts(
  locations: readonly LanguageServerLocation[],
  askingFile: string,
  readFile: (filePath: string) => string | null
): Record<string, string> {
  const files: Record<string, string> = {}
  const others = [...new Set(locations.map((location) => location.filePath))].filter(
    (path) => path !== askingFile
  )
  for (const path of others.slice(0, MAX_REFERENCE_FILES)) {
    const content = readFile(path)
    if (content !== null) {
      files[path] = content
    }
  }
  return files
}
