/**
 * Converts a VS Code colour theme into the shape `monaco.editor.defineTheme` takes.
 *
 * Why this exists: Orca's editor and diff viewer are hardcoded to stock `vs` / `vs-dark`. A theme
 * file is the one place a user's colours are already written down, and its `colors` map uses the
 * same key names Monaco does — so the UI half, which is what a diff viewer is mostly made of,
 * transfers exactly.
 *
 * The `tokenColors` half does not transfer exactly. Those are TextMate scopes, and Monaco's default
 * tokenizer emits its own token names, so scopes are matched by prefix and land close rather than
 * identical. `vscode-textmate` is already a dependency here (see lib/monaco-languages) if that is
 * ever worth doing properly.
 */

export type MonacoThemeRule = {
  token: string
  foreground?: string
  background?: string
  fontStyle?: string
}

export type MonacoThemeData = {
  base: 'vs' | 'vs-dark' | 'hc-black'
  inherit: boolean
  rules: MonacoThemeRule[]
  colors: Record<string, string>
}

type TokenColor = {
  scope?: string | string[]
  settings?: { foreground?: string; background?: string; fontStyle?: string }
}

type VsCodeThemeFile = {
  name?: string
  type?: string
  include?: string
  colors?: Record<string, unknown>
  tokenColors?: TokenColor[]
}

/**
 * Parse a theme file.
 *
 * Why not `JSON.parse`: VS Code themes are JSONC — they carry `//` comments and trailing commas, and
 * every real theme in the wild uses both. Strings are stepped over so a `//` inside a colour or a
 * scope name is not mistaken for a comment.
 */
export function parseJsonc(raw: string): unknown {
  let out = ''
  let inString = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    const next = raw[i + 1]

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false
        out += char
      }
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false
        i += 1
      }
      continue
    }
    if (inString) {
      out += char
      if (char === '\\') {
        out += next ?? ''
        i += 1
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      out += char
      continue
    }
    if (char === '/' && next === '/') {
      inLineComment = true
      i += 1
      continue
    }
    if (char === '/' && next === '*') {
      inBlockComment = true
      i += 1
      continue
    }
    out += char
  }

  // Trailing commas, now that no comment or string can be misread as one.
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1')) as unknown
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/** Monaco takes rule colours without the leading `#`, but theme files always carry one. */
function toRuleColor(value: string | undefined): string | undefined {
  if (!value || !HEX_COLOR.test(value)) {
    return undefined
  }
  return value.slice(1)
}

function isThemeFile(value: unknown): value is VsCodeThemeFile {
  return typeof value === 'object' && value !== null
}

/**
 * Build Monaco theme data from a parsed VS Code theme.
 *
 * `base` decides what Monaco falls back to for anything the file does not specify, so a dark theme
 * must not inherit light defaults — an unstyled token would otherwise come out near-invisible.
 */
export function toMonacoTheme(parsed: unknown, fallbackDark = true): MonacoThemeData | null {
  if (!isThemeFile(parsed)) {
    return null
  }
  const isDark = parsed.type ? parsed.type.toLowerCase() !== 'light' : fallbackDark

  const colors: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed.colors ?? {})) {
    // Why the filter: Monaco throws on a malformed colour rather than skipping it, and themes carry
    // keys for surfaces Monaco does not have.
    if (typeof value === 'string' && HEX_COLOR.test(value)) {
      colors[key] = value
    }
  }

  const rules: MonacoThemeRule[] = []
  for (const entry of parsed.tokenColors ?? []) {
    const scopes =
      typeof entry.scope === 'string'
        ? entry.scope.split(',').map((scope) => scope.trim())
        : (entry.scope ?? [])
    const foreground = toRuleColor(entry.settings?.foreground)
    const background = toRuleColor(entry.settings?.background)
    const fontStyle = entry.settings?.fontStyle
    if (!foreground && !background && !fontStyle) {
      continue
    }
    for (const scope of scopes) {
      if (!scope) {
        continue
      }
      rules.push({
        token: scope,
        ...(foreground ? { foreground } : {}),
        ...(background ? { background } : {}),
        ...(fontStyle ? { fontStyle } : {})
      })
    }
  }

  return { base: isDark ? 'vs-dark' : 'vs', inherit: true, rules, colors }
}
