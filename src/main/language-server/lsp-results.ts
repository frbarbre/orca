import { fileURLToPath } from 'node:url'
import type { LanguageServerLocation } from '../../shared/language-server'

type Position = { line: number; character: number }
type Range = { start: Position; end: Position }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRange(value: unknown): Range | null {
  if (!isRecord(value) || !isRecord(value.start)) {
    return null
  }
  const { line, character } = value.start
  return typeof line === 'number' && typeof character === 'number'
    ? { start: { line, character }, end: { line, character } }
    : null
}

function toLocation(value: unknown): LanguageServerLocation | null {
  if (!isRecord(value)) {
    return null
  }
  const uri = typeof value.targetUri === 'string' ? value.targetUri : value.uri
  const range = readRange(value.targetSelectionRange ?? value.targetRange ?? value.range)
  if (typeof uri !== 'string' || !uri.startsWith('file:') || !range) {
    return null
  }
  return { filePath: fileURLToPath(uri), line: range.start.line, character: range.start.character }
}

export function readDefinitionLocations(result: unknown): LanguageServerLocation[] {
  const items = Array.isArray(result) ? result : [result]
  return items.flatMap((item) => {
    const location = toLocation(item)
    return location ? [location] : []
  })
}

function markedStringToMarkdown(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (isRecord(value) && typeof value.value === 'string') {
    return typeof value.language === 'string'
      ? `\`\`\`${value.language}\n${value.value}\n\`\`\``
      : value.value
  }
  return null
}

// Why three shapes: LSP hover contents is MarkupContent, a MarkedString, or a MarkedString[].
export function readHoverMarkdown(result: unknown): string | null {
  const contents = isRecord(result) ? result.contents : null
  const parts = (Array.isArray(contents) ? contents : [contents])
    .map(markedStringToMarkdown)
    .filter((part): part is string => Boolean(part?.trim()))
  return parts.length > 0 ? parts.join('\n\n') : null
}
