import { pathToFileURL } from 'node:url'

export type WatchedFileChange = { filePath: string; type: 'create' | 'update' | 'delete' }

// LSP FileChangeType: Created = 1, Changed = 2, Deleted = 3.
// Why Changed before Created: an atomic save replaces a known file and arrives as a create, and
// tsgo drops a Created for a file it already has unless a Changed for it came first.
const FILE_CHANGE_TYPES: Record<WatchedFileChange['type'], readonly number[]> = {
  create: [2, 1],
  update: [2],
  delete: [3]
}

export function didChangeWatchedFiles(changes: readonly WatchedFileChange[]): {
  method: string
  params: { changes: { uri: string; type: number }[] }
} {
  return {
    method: 'workspace/didChangeWatchedFiles',
    params: {
      changes: changes.flatMap(({ filePath, type }) => {
        const uri = pathToFileURL(filePath).href
        return FILE_CHANGE_TYPES[type].map((changeType) => ({ uri, type: changeType }))
      })
    }
  }
}
