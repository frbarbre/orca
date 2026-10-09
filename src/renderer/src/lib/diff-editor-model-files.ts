export type TrackedModelFile = { worktreeId: string; relativePath: string }

type Disposable = { dispose: () => void }
type TrackableEditor = {
  getModel: () => { uri: { toString: () => string } } | null
  onDidChangeModel: (listener: () => void) => Disposable
  onDidDispose: (listener: () => void) => Disposable
}

// Why: diff editors name their models with internal diff paths, not the file's own path, so
// Python go-to-definition needs this map to know which worktree file a diff side shows.
const filesByModelUri = new Map<string, TrackedModelFile>()

export function trackDiffEditorFile(
  diffEditor: {
    getOriginalEditor: () => TrackableEditor
    getModifiedEditor: () => TrackableEditor
  },
  file: TrackedModelFile
): void {
  const sides = [diffEditor.getOriginalEditor(), diffEditor.getModifiedEditor()]
  const current = new Map<TrackableEditor, string | null>()
  const forget = (uri: string | null | undefined): void => {
    if (uri && filesByModelUri.get(uri) === file) {
      filesByModelUri.delete(uri)
    }
  }
  const track = (side: TrackableEditor): void => {
    forget(current.get(side))
    const uri = side.getModel()?.uri.toString() ?? null
    current.set(side, uri)
    if (uri) {
      filesByModelUri.set(uri, file)
    }
  }
  const subscriptions: Disposable[] = []
  for (const side of sides) {
    track(side)
    subscriptions.push(side.onDidChangeModel(() => track(side)))
  }
  const release = (): void => {
    for (const uri of current.values()) {
      forget(uri)
    }
    current.clear()
    for (const subscription of subscriptions) {
      subscription.dispose()
    }
  }
  for (const side of sides) {
    side.onDidDispose(release)
  }
}

export function modelFileFor(uri: string): TrackedModelFile | undefined {
  return filesByModelUri.get(uri)
}
