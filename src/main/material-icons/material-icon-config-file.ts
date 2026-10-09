import {
  MATERIAL_ICON_CONFIG_FILE_NAME,
  readMaterialIconConfig,
  type MaterialIconConfigSnapshot
} from '../../shared/material-icon-config'

const STARTING_FILE = {
  'material-icon-theme.files.associations': {},
  'material-icon-theme.folders.associations': {}
}

export function createMaterialIconConfigFile({
  path,
  exists,
  read,
  write
}: {
  path: string
  exists: (path: string) => boolean
  read: (path: string) => string
  write: (path: string, text: string) => void
}): { read: () => MaterialIconConfigSnapshot; ensure: () => void } {
  return {
    read: () => {
      if (!exists(path)) {
        return { path, exists: false, config: {}, errors: [] }
      }
      let document: unknown
      try {
        document = JSON.parse(read(path))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
          path,
          exists: true,
          config: {},
          errors: [`Invalid JSON in ${MATERIAL_ICON_CONFIG_FILE_NAME}: ${reason}`]
        }
      }
      return { path, exists: true, ...readMaterialIconConfig(document) }
    },
    ensure: () => {
      if (!exists(path)) {
        write(path, `${JSON.stringify(STARTING_FILE, null, 2)}\n`)
      }
    }
  }
}
