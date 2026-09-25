import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseJsonc, toMonacoTheme, type MonacoThemeData } from '../../shared/vscode-theme'

export type CustomEditorThemes = {
  dark: MonacoThemeData | null
  light: MonacoThemeData | null
}

/**
 * User-supplied editor themes, read from `~/.orca/themes/`.
 *
 * Why files rather than a bundled theme: a VS Code theme is someone else's work under someone
 * else's licence, so shipping one inside this repo is not ours to do. Pointing at a file the user
 * already has keeps the colours out of the repo and works for any theme, not one chosen for them.
 *
 *   ~/.orca/themes/editor-dark.json
 *   ~/.orca/themes/editor-light.json
 *
 * Either may be absent; the editor falls back to stock `vs-dark` / `vs` for whichever is missing.
 */
export function customEditorThemeDirectory(): string {
  return join(homedir(), '.orca', 'themes')
}

function readTheme(fileName: string, fallbackDark: boolean): MonacoThemeData | null {
  const path = join(customEditorThemeDirectory(), fileName)
  if (!existsSync(path)) {
    return null
  }
  try {
    return toMonacoTheme(parseJsonc(readFileSync(path, 'utf8')), fallbackDark)
  } catch (error) {
    // Why swallow: a malformed theme must not stop the editor from opening. The stock theme is a
    // fine outcome; a renderer that cannot mount is not.
    console.warn(`[editor-theme] ignoring ${path}:`, error)
    return null
  }
}

export function loadCustomEditorThemes(): CustomEditorThemes {
  return {
    dark: readTheme('editor-dark.json', true),
    light: readTheme('editor-light.json', false)
  }
}
