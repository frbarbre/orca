type IconMaps = {
  fileNames?: Record<string, string>
  fileExtensions?: Record<string, string>
  folderNames?: Record<string, string>
  folderNamesExpanded?: Record<string, string>
}

export type IconManifest = IconMaps & {
  file?: string
  folder?: string
  folderExpanded?: string
  light?: IconMaps
}

function baseName(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return (lastSlash >= 0 ? path.slice(lastSlash + 1) : path).toLowerCase()
}

function lookUp(
  manifest: IconManifest,
  map: keyof IconMaps,
  key: string,
  light: boolean
): string | undefined {
  return (light ? manifest.light?.[map]?.[key] : undefined) ?? manifest[map]?.[key]
}

export function fileIconName(manifest: IconManifest, filePath: string, light: boolean): string {
  const name = baseName(filePath)
  const byName = name ? lookUp(manifest, 'fileNames', name, light) : undefined
  if (byName) {
    return byName
  }
  // Why left to right: "a.test.ts" tries "test.ts" before "ts", the longest extension first.
  for (let dot = name.indexOf('.'); dot >= 0; dot = name.indexOf('.', dot + 1)) {
    const byExtension = lookUp(manifest, 'fileExtensions', name.slice(dot + 1), light)
    if (byExtension) {
      return byExtension
    }
  }
  return manifest.file ?? 'file'
}

export function folderIconName(
  manifest: IconManifest,
  folderPath: string,
  open: boolean,
  light: boolean
): string {
  const named = lookUp(
    manifest,
    open ? 'folderNamesExpanded' : 'folderNames',
    baseName(folderPath),
    light
  )
  return named ?? (open ? manifest.folderExpanded : manifest.folder) ?? 'folder'
}
