import { createElement, type ComponentType } from 'react'
import { File, FileCog, FileLock, FileTerminal, Smartphone, type LucideIcon } from 'lucide-react'
import { COMPOUND_EXTENSIONS, FILE_ICON_BY_EXTENSION } from './file-type-icon-extension-table'
import { FILE_ICON_BY_NAME } from './file-type-icon-name-table'
import { MaterialFileIcon, type MaterialIconProps } from './material-icons/material-icon'

export type FileTypeIcon = ComponentType<MaterialIconProps>

const MAX_CACHED_ICONS = 5_000
const materialIconByPath = new Map<string, FileTypeIcon>()

// Fork: Material Icon Theme icons. Why one component per path: callers render the returned
// component, so a fresh one each call would remount the icon on every render.
export function getFileTypeIcon(filePath: string | undefined | null): FileTypeIcon {
  const path = filePath ?? ''
  const lowerName = getFilename(path).toLowerCase()
  if (lowerName === 'mobile emulator' || lowerName === 'simulator') {
    return Smartphone
  }
  let icon = materialIconByPath.get(path)
  if (!icon) {
    const PathIcon: FileTypeIcon = (props) => createElement(MaterialFileIcon, { ...props, path })
    if (materialIconByPath.size >= MAX_CACHED_ICONS) {
      materialIconByPath.clear()
    }
    materialIconByPath.set(path, PathIcon)
    icon = PathIcon
  }
  return icon
}

function getFilename(filePath: string | undefined | null): string {
  if (!filePath) {
    return ''
  }
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath
}

function getExtension(filename: string): string {
  const lowerName = filename.toLowerCase()
  const compoundExtension = COMPOUND_EXTENSIONS.find((ext) => lowerName.endsWith(`.${ext}`))
  if (compoundExtension) {
    return compoundExtension
  }

  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return ''
  }

  return filename.slice(lastDot + 1).toLowerCase()
}

export function getLucideFileTypeIcon(filePath: string | undefined | null): LucideIcon {
  const filename = getFilename(filePath)
  if (!filename) {
    return File
  }
  const lowerName = filename.toLowerCase()
  const exactMatch = FILE_ICON_BY_NAME[lowerName]
  if (exactMatch) {
    return exactMatch
  }

  // Why: simulator tabs reuse EditorFileTab chrome with a synthetic label path.
  if (lowerName === 'mobile emulator' || lowerName === 'simulator') {
    return Smartphone
  }

  if (lowerName === '.env' || lowerName.startsWith('.env.')) {
    return FileLock
  }

  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) {
    return FileCog
  }

  if (lowerName === 'makefile' || lowerName.startsWith('makefile.')) {
    return FileTerminal
  }

  // Why: filename/extension matching keeps icons deterministic for SSH worktrees
  // where OS-native file associations are not available.
  return FILE_ICON_BY_EXTENSION[getExtension(filename)] ?? File
}
