import { existsSync, readFileSync, statSync } from 'node:fs'
import { app, BrowserWindow, ipcMain } from 'electron'
import { isLanguageServerLanguage, type LanguageServerRequest } from '../../shared/language-server'
import type { EditorDiagnosticsEvent } from '../../shared/editor-diagnostics'
import { isLinterId, type LintRequest } from '../../shared/linter'
import { isFormatterId, type FormatRequest } from '../../shared/formatter'
import { createFormatterService } from '../language-server/formatter-service'
import { createLintService } from '../language-server/lint-service'
import { createLanguageServerService } from '../language-server/language-server-service'
import { startLanguageServerSession } from '../language-server/language-server-process'
import { createProjectFileWatcher } from '../language-server/language-server-file-watcher'
import { setLanguageServerRemovalStop } from '../language-server/language-server-removal'
import { beginWatcherInstall } from './watcher-removal-gate'

function readRequest(value: unknown): LanguageServerRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const {
    language,
    server,
    command,
    filePath,
    worktreeRoot,
    repoRoot,
    venvSetting,
    text,
    line,
    character
  } = value as Record<string, unknown>
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
    server: typeof server === 'string' ? server : '',
    command: typeof command === 'string' && command.trim() ? command.trim() : null,
    filePath,
    worktreeRoot,
    repoRoot: typeof repoRoot === 'string' && repoRoot ? repoRoot : null,
    venvSetting: typeof venvSetting === 'string' ? venvSetting : null,
    text,
    line,
    character
  }
}

function readLintRequest(value: unknown): LintRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { linter, command, filePath, worktreeRoot, repoRoot, text } = value as Record<
    string,
    unknown
  >
  if (
    !isLinterId(linter) ||
    typeof filePath !== 'string' ||
    typeof worktreeRoot !== 'string' ||
    typeof text !== 'string'
  ) {
    return null
  }
  return {
    linter,
    command: typeof command === 'string' && command.trim() ? command.trim() : null,
    filePath,
    worktreeRoot,
    repoRoot: typeof repoRoot === 'string' && repoRoot ? repoRoot : null,
    text
  }
}

function readFormatRequest(value: unknown): FormatRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { formatter, command, filePath, worktreeRoot, repoRoot, venvSetting, text } =
    value as Record<string, unknown>
  const { tabSize, insertSpaces } = value as Record<string, unknown>
  if (
    !isFormatterId(formatter) ||
    typeof filePath !== 'string' ||
    typeof worktreeRoot !== 'string' ||
    typeof text !== 'string'
  ) {
    return null
  }
  return {
    formatter,
    command: typeof command === 'string' && command.trim() ? command.trim() : null,
    filePath,
    worktreeRoot,
    repoRoot: typeof repoRoot === 'string' && repoRoot ? repoRoot : null,
    venvSetting: typeof venvSetting === 'string' ? venvSetting : null,
    text,
    tabSize: typeof tabSize === 'number' && tabSize > 0 ? tabSize : 2,
    insertSpaces: insertSpaces !== false
  }
}

const PREVIEW_LINES = 10
const MAX_PREVIEW_FILE_BYTES = 5_000_000

function readFile(filePath: string): string | null {
  try {
    return statSync(filePath).size > MAX_PREVIEW_FILE_BYTES ? null : readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
}

function readPreview(filePath: string, line: number): string | null {
  return (
    readFile(filePath)
      ?.split(/\r?\n/)
      .slice(line, line + PREVIEW_LINES)
      .join('\n') ?? null
  )
}

// Fork: Cmd+click, hover and type errors come from a language server (pyrefly for Python, tsgo
// for TypeScript); lint squiggles from each project's linter.
function broadcast(channel: string, event: EditorDiagnosticsEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, event)
    }
  }
}

export function registerLanguageServerHandlers(): void {
  const service = createLanguageServerService({
    exists: existsSync,
    readPreview,
    readFile,
    startSession: startLanguageServerSession,
    watchFiles: createProjectFileWatcher(),
    admit: (projectRoot) => beginWatcherInstall(projectRoot),
    onDiagnostics: (event) => broadcast('languageServer:diagnostics', event)
  })
  const lint = createLintService({
    exists: existsSync,
    startSession: startLanguageServerSession,
    onDiagnostics: (event) => broadcast('lint:diagnostics', event),
    admit: (projectRoot) => beginWatcherInstall(projectRoot)
  })
  const formatters = createFormatterService({
    files: { exists: existsSync, read: readFile },
    startSession: (launch) => startLanguageServerSession(launch),
    admit: (projectRoot) => beginWatcherInstall(projectRoot)
  })
  setLanguageServerRemovalStop((root) => {
    service.stopUnder(root)
    lint.stopUnder(root)
    formatters.stopUnder(root)
  })
  ipcMain.handle('formatter:format', async (_event, args: unknown) => {
    const request = readFormatRequest(args)
    return request ? formatters.format(request) : { ok: false, error: 'Invalid format request.' }
  })
  ipcMain.handle('formatter:stop', (_event, args: unknown) => {
    const formatter = (args as { formatter?: unknown } | null)?.formatter
    if (isFormatterId(formatter)) {
      formatters.stopFormatter(formatter)
    }
  })
  app.once('will-quit', () => formatters.disposeAll())
  ipcMain.handle('lint:sync', async (_event, args: unknown) => {
    const request = readLintRequest(args)
    return request ? lint.sync(request) : { ok: false, error: 'Invalid lint request.' }
  })
  ipcMain.handle('lint:close', (_event, args: unknown) => {
    const { linter, filePath } = (args ?? {}) as { linter?: unknown; filePath?: unknown }
    if (isLinterId(linter) && typeof filePath === 'string') {
      lint.close({ linter, filePath })
    }
  })
  ipcMain.handle('lint:stop', (_event, args: unknown) => {
    const linter = (args as { linter?: unknown } | null)?.linter
    if (isLinterId(linter)) {
      lint.stopLinter(linter)
    }
  })
  app.once('will-quit', () => lint.disposeAll())
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
  ipcMain.handle('languageServer:references', async (_event, args: unknown) => {
    const request = readRequest(args)
    return request
      ? service.references(request)
      : { ok: false, error: 'Invalid language server request.' }
  })
  ipcMain.handle('languageServer:completion', async (_event, args: unknown) => {
    const request = readRequest(args)
    const trigger = (args as { triggerCharacter?: unknown } | null)?.triggerCharacter
    return request
      ? service.completion({
          ...request,
          ...(typeof trigger === 'string' && trigger.length === 1
            ? { triggerCharacter: trigger }
            : {})
        })
      : { ok: false, error: 'Invalid language server request.' }
  })
  ipcMain.handle('languageServer:sync', async (_event, args: unknown) => {
    const request = readRequest({ ...(args as object), line: 0, character: 0 })
    return request
      ? service.sync(request)
      : { ok: false, error: 'Invalid language server request.' }
  })
  ipcMain.handle('languageServer:close', (_event, args: unknown) => {
    const { language, filePath } = (args ?? {}) as { language?: unknown; filePath?: unknown }
    if (isLanguageServerLanguage(language) && typeof filePath === 'string') {
      service.closeDocument({ language, filePath })
    }
  })
  ipcMain.handle('languageServer:stop', (_event, args: unknown) => {
    const language = (args as { language?: unknown } | null)?.language
    if (isLanguageServerLanguage(language)) {
      service.stopLanguage(language)
    }
  })
  app.once('will-quit', () => service.disposeAll())
}
