export const MATERIAL_ICON_FOLDER_THEMES = ['specific', 'classic', 'none'] as const

export type MaterialIconConfig = {
  activeIconPack?: string
  files?: { associations?: Record<string, string> }
  folders?: {
    theme?: (typeof MATERIAL_ICON_FOLDER_THEMES)[number]
    associations?: Record<string, string>
  }
  languages?: { associations?: Record<string, string> }
}

export type MaterialIconConfigResult = { config: MaterialIconConfig; errors: string[] }

export type MaterialIconConfigSnapshot = MaterialIconConfigResult & {
  path: string
  exists: boolean
}

export const MATERIAL_ICON_CONFIG_FILE_NAME = 'material-icon-theme.json'

const VS_CODE_PREFIX = 'material-icon-theme.'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Why both shapes: the VS Code extension's keys are flat ("material-icon-theme.files.associations"),
// so pasting them from settings.json works, and nested JSON reads naturally too.
function settingAt(document: Record<string, unknown>, path: string): unknown {
  const flat = document[`${VS_CODE_PREFIX}${path}`]
  if (flat !== undefined) {
    return flat
  }
  let value: unknown = document
  for (const key of path.split('.')) {
    value = isRecord(value) ? value[key] : undefined
  }
  return value
}

function readAssociations(
  document: Record<string, unknown>,
  path: string,
  errors: string[]
): Record<string, string> | undefined {
  const value = settingAt(document, path)
  if (value === undefined) {
    return undefined
  }
  if (!isRecord(value)) {
    errors.push(`${path} must be an object of name → icon.`)
    return undefined
  }
  const associations: Record<string, string> = {}
  for (const [name, icon] of Object.entries(value)) {
    if (typeof icon === 'string' && icon.trim()) {
      associations[name] = icon.trim()
    } else {
      errors.push(`${path}.${name} must name an icon.`)
    }
  }
  return associations
}

export function readMaterialIconConfig(document: unknown): MaterialIconConfigResult {
  if (!isRecord(document)) {
    return { config: {}, errors: ['The icon settings file must contain a JSON object.'] }
  }
  const errors: string[] = []
  const config: MaterialIconConfig = {}

  const iconPack = settingAt(document, 'activeIconPack')
  if (typeof iconPack === 'string') {
    config.activeIconPack = iconPack
  } else if (iconPack !== undefined) {
    errors.push('activeIconPack must be the name of an icon pack.')
  }

  const files = readAssociations(document, 'files.associations', errors)
  if (files) {
    config.files = { associations: files }
  }

  const theme = settingAt(document, 'folders.theme')
  const folderTheme = MATERIAL_ICON_FOLDER_THEMES.find((candidate) => candidate === theme)
  if (theme !== undefined && !folderTheme) {
    errors.push('folders.theme must be "specific", "classic" or "none".')
  }
  const folders = readAssociations(document, 'folders.associations', errors)
  if (folderTheme || folders) {
    config.folders = {
      ...(folderTheme ? { theme: folderTheme } : {}),
      ...(folders ? { associations: folders } : {})
    }
  }

  const languages = readAssociations(document, 'languages.associations', errors)
  if (languages) {
    config.languages = { associations: languages }
  }
  return { config, errors }
}
