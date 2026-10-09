import type * as Monaco from 'monaco-editor'
import { toast } from 'sonner'
import type { GitBlameLine, GitBlameLinks } from '../../../shared/git-blame'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { isModifiedDiffSide, modelFileFor } from './diff-editor-model-files'
import {
  blameHoverMarkdown,
  blameInlineText,
  fitInlineText,
  gitBlameSettings
} from './git-blame-text'
import { openFileContext, trackedFileContext } from './language-server-editor'

const BLAME_DELAY_MS = 250
const MAX_BLAMED_LINES = 16_384
const INLINE_GAP = ' '.repeat(6)
const COMMANDS = ['orca.gitBlame.openUrl', 'orca.gitBlame.copyHash', 'orca.gitBlame.showCommit']

let lastBlamed: { worktreeId: string; worktreeRoot: string; summary: string } | null = null

async function showCommit(sha: string): Promise<void> {
  const source = lastBlamed
  if (!source) {
    return
  }
  const failed = translate('auto.lib.gitBlame.showCommitFailed', 'Failed to load the commit')
  try {
    const result = await window.api.git.commitCompare({
      worktreePath: source.worktreeRoot,
      commitId: sha
    })
    if (result.summary.status !== 'ready') {
      toast.error(result.summary.errorMessage ?? failed)
      return
    }
    useAppStore
      .getState()
      .openCommitAllDiffs(
        source.worktreeId,
        source.worktreeRoot,
        result.summary,
        result.entries,
        source.summary
      )
  } catch (error) {
    toast.error(error instanceof Error ? error.message : failed)
  }
}

function registerCommands(monaco: typeof Monaco): void {
  monaco.editor.registerCommand('orca.gitBlame.openUrl', (_accessor, url: unknown) => {
    if (typeof url === 'string' && url.startsWith('https://')) {
      void window.api.shell.openUrl(url)
    }
  })
  monaco.editor.registerCommand('orca.gitBlame.copyHash', (_accessor, sha: unknown) => {
    if (typeof sha === 'string') {
      void window.api.ui.writeClipboardText(sha)
      toast.success(translate('auto.lib.gitBlame.copied', 'Commit hash copied'))
    }
  })
  monaco.editor.registerCommand('orca.gitBlame.showCommit', (_accessor, sha: unknown) => {
    if (typeof sha === 'string') {
      void showCommit(sha)
    }
  })
}

function blameTarget(model: Monaco.editor.ITextModel) {
  const { uri } = model
  const tracked = modelFileFor(uri.toString())
  if (tracked) {
    // Why the modified side only: the original side shows an older version, not today's lines.
    const context = isModifiedDiffSide(uri.toString())
      ? trackedFileContext(useAppStore.getState(), tracked)
      : null
    return context
  }
  // Why: a remote/runtime-owned model has no local file to blame.
  if (uri.scheme !== 'file' || uri.fragment) {
    return null
  }
  const context = openFileContext(useAppStore.getState(), uri.fsPath)
  return context ? { ...context, filePath: uri.fsPath } : null
}

function attachBlame(monaco: typeof Monaco, editor: Monaco.editor.ICodeEditor): () => void {
  const decorations = editor.createDecorationsCollection()
  let timer: ReturnType<typeof setTimeout> | undefined
  let request = 0
  let blamedLine = 0

  let lastRender: { line: number; blame: GitBlameLine; links: GitBlameLinks | null } | null = null

  // Why measure: the text must end at the editor's edge, never wrap the line or scroll it sideways.
  const roomForText = (line: number, end: number): number => {
    const position = editor.getScrolledVisiblePosition({ lineNumber: line, column: end })
    if (!position) {
      return 0
    }
    const layout = editor.getLayoutInfo()
    const right = layout.contentLeft + layout.contentWidth - layout.verticalScrollbarWidth
    const charWidth = editor.getOption(
      monaco.editor.EditorOption.fontInfo
    ).typicalHalfwidthCharacterWidth
    return Math.floor((right - position.left) / charWidth) - INLINE_GAP.length - 2
  }

  const render = (line: number, blame: GitBlameLine, links: GitBlameLinks | null): void => {
    const model = editor.getModel()
    if (!model || line > model.getLineCount()) {
      return
    }
    lastRender = { line, blame, links }
    const options = { ...gitBlameSettings(useAppStore.getState().settings), now: Date.now() }
    const end = model.getLineMaxColumn(line)
    const text = fitInlineText(blameInlineText(blame, options, links), roomForText(line, end))
    if (!text) {
      decorations.clear()
      return
    }
    decorations.set([
      {
        range: new monaco.Range(line, end, line, end),
        options: {
          showIfCollapsed: true,
          after: {
            // Why spaces, not a CSS margin: Monaco splits long injected text into several spans.
            content: `${INLINE_GAP}${text}`,
            inlineClassName: 'orca-git-blame-inline',
            cursorStops: monaco.editor.InjectedTextCursorStops.None
          },
          hoverMessage: {
            value: blameHoverMarkdown(blame, links, options),
            isTrusted: { enabledCommands: COMMANDS }
          }
        }
      }
    ])
  }

  const blame = async (): Promise<void> => {
    const current = ++request
    const model = editor.getModel()
    const position = editor.getPosition()
    const target = model ? blameTarget(model) : null
    if (
      !model ||
      !position ||
      !target ||
      !editor.hasTextFocus() ||
      !gitBlameSettings(useAppStore.getState().settings).enabled ||
      (editor.getSelections()?.length ?? 0) > 1 ||
      model.getLineCount() > MAX_BLAMED_LINES
    ) {
      return
    }
    const line = position.lineNumber
    const result = await window.api.gitBlame.line({
      worktreeRoot: target.worktreeRoot,
      filePath: target.filePath,
      line,
      text: model.getValue()
    })
    if (current !== request || !result.ok) {
      return
    }
    blamedLine = line
    render(line, result.blame, null)
    if (result.blame.uncommitted) {
      return
    }
    const { commit } = result.blame
    lastBlamed = {
      worktreeId: target.worktreeId,
      worktreeRoot: target.worktreeRoot,
      summary: commit.summary
    }
    const links = await window.api.gitBlame.links({
      worktreeRoot: target.worktreeRoot,
      sha: commit.sha,
      summary: commit.summary
    })
    if (current === request) {
      render(line, result.blame, links)
    }
  }

  const schedule = (): void => {
    request++
    blamedLine = 0
    lastRender = null
    decorations.clear()
    clearTimeout(timer)
    timer = setTimeout(() => void blame(), BLAME_DELAY_MS)
  }

  const subscriptions = [
    editor.onDidChangeCursorPosition((event) => {
      if (event.position.lineNumber !== blamedLine) {
        schedule()
      }
    }),
    editor.onDidChangeModelContent(schedule),
    editor.onDidChangeModel(schedule),
    editor.onDidFocusEditorText(() => {
      if (!blamedLine) {
        schedule()
      }
    }),
    editor.onDidLayoutChange(() => {
      if (lastRender) {
        render(lastRender.line, lastRender.blame, lastRender.links)
      }
    })
  ]
  editor.onDidDispose(() => {
    clearTimeout(timer)
    for (const subscription of subscriptions) {
      subscription.dispose()
    }
  })
  return schedule
}

// Fork: Git Blame for the cursor's line — author, when, and the commit's PR on GitHub, or
// "Uncommitted change" — like VS Code's Git Blame extension.
export function installMonacoGitBlame(monaco: typeof Monaco): void {
  registerCommands(monaco)
  const refreshers = new Set<() => void>()
  monaco.editor.onDidCreateEditor((editor) => {
    const refresh = attachBlame(monaco, editor)
    refreshers.add(refresh)
    editor.onDidDispose(() => refreshers.delete(refresh))
  })
  useAppStore.subscribe((state, previous) => {
    if (state.settings?.gitBlame !== previous.settings?.gitBlame) {
      for (const refresh of refreshers) {
        refresh()
      }
    }
  })
}
