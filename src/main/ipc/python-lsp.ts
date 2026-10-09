import { existsSync } from 'node:fs'
import { app, ipcMain } from 'electron'
import type { PythonDefinitionRequest } from '../../shared/python-definition'
import { createPythonDefinitionService } from '../python-lsp/python-definition-service'
import { startPyreflyProcessSession } from '../python-lsp/pyrefly-process'

function readRequest(value: unknown): PythonDefinitionRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { filePath, worktreeRoot, venvSetting, text, line, character } = value as Record<
    string,
    unknown
  >
  if (
    typeof filePath !== 'string' ||
    typeof worktreeRoot !== 'string' ||
    typeof text !== 'string' ||
    typeof line !== 'number' ||
    typeof character !== 'number'
  ) {
    return null
  }
  return {
    filePath,
    worktreeRoot,
    venvSetting: typeof venvSetting === 'string' ? venvSetting : null,
    text,
    line,
    character
  }
}

// Fork: Cmd+click in Python files asks a pyrefly language server for the definition.
export function registerPythonLspHandlers(): void {
  const service = createPythonDefinitionService({
    exists: existsSync,
    startSession: startPyreflyProcessSession
  })
  ipcMain.handle('python:definition', async (_event, args: unknown) => {
    const request = readRequest(args)
    return request
      ? service.definition(request)
      : { ok: false, error: 'Invalid Python definition request.' }
  })
  app.once('will-quit', () => service.disposeAll())
}
