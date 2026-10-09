import { existsSync, readFileSync, statSync } from 'node:fs'
import { app, ipcMain } from 'electron'
import { isLanguageServerLanguage, type LanguageServerRequest } from '../../shared/language-server'
import { createLanguageServerService } from '../language-server/language-server-service'
import { startLanguageServerSession } from '../language-server/language-server-process'

function readRequest(value: unknown): LanguageServerRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { language, filePath, worktreeRoot, repoRoot, venvSetting, text, line, character } =
    value as Record<string, unknown>
  if (
    !isLanguageServerLanguage(language) ||
    typeof filePath !== 'string' ||
    typeof worktreeRoot !== 'string' ||
    typeof text !== 'string' ||
    typeof line !== 'number' ||
    typeof character !== 'number'
  ) {
    return null
  }
  return {
    language,
    filePath,
    worktreeRoot,
    repoRoot: typeof repoRoot === 'string' && repoRoot ? repoRoot : null,
    venvSetting: typeof venvSetting === 'string' ? venvSetting : null,
    text,
    line,
    character
  }
}

const PREVIEW_LINES = 10
const MAX_PREVIEW_FILE_BYTES = 5_000_000

function readPreview(filePath: string, line: number): string | null {
  try {
    if (statSync(filePath).size > MAX_PREVIEW_FILE_BYTES) {
      return null
    }
    return readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .slice(line, line + PREVIEW_LINES)
      .join('\n')
  } catch {
    return null
  }
}

// Fork: Cmd+click and hover ask a language server (pyrefly for Python, tsgo for TypeScript).
export function registerLanguageServerHandlers(): void {
  const service = createLanguageServerService({
    exists: existsSync,
    readPreview,
    startSession: startLanguageServerSession
  })
  ipcMain.handle('languageServer:definition', async (_event, args: unknown) => {
    const request = readRequest(args)
    return request
      ? service.definition(request)
      : { ok: false, error: 'Invalid language server request.' }
  })
  ipcMain.handle('languageServer:hover', async (_event, args: unknown) => {
    const request = readRequest(args)
    return request
      ? service.hover(request)
      : { ok: false, error: 'Invalid language server request.' }
  })
  ipcMain.handle('languageServer:stop', (_event, args: unknown) => {
    const language = (args as { language?: unknown } | null)?.language
    if (isLanguageServerLanguage(language)) {
      service.stopLanguage(language)
    }
  })
  app.once('will-quit', () => service.disposeAll())
}
