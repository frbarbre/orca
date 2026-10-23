import { useQuickOpenInteraction } from './use-quick-open-interaction'
import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useAppStore } from '@/store'
import { useActiveWorktree } from '@/store/selectors'
import { CommandDialog, CommandInput, CommandList, CommandEmpty } from '@/components/ui/command'
import {
  parseQuickOpenQueryTarget,
  isQuickOpenAbsolutePath,
  type QuickOpenQueryTarget
} from '../../../shared/quick-open-query-target'
import { scheduleEditorLineReveal } from '@/store/slices/editor/focus/editor-focus-reveal'
import {
  parseQuickOpenGoToLine,
  parseQuickOpenTextQuery,
  quickOpenTextSearchRows,
  type QuickOpenTextRow
} from './quick-open-modes'
import { useQuickOpenTextSearch } from './use-quick-open-text-search'
import {
  QUICK_OPEN_GO_TO_LINE_VALUE,
  QuickOpenGoToLineItem,
  QuickOpenTextItems
} from './QuickOpenModeItems'
import { openQuickOpenFile } from './quick-open-file-navigation'
import { openQuickOpenChange, resolveQuickOpenTarget } from './quick-open-change'
import { useQuickOpenChanges } from './use-quick-open-changes'
import { QuickOpenFileItem } from './QuickOpenFileItem'
import { rankQuickOpenFilesWithHistory } from './quick-open-history-ranking'
import { useQuickOpenHistory } from '@/lib/quick-open-file-history'
import { useRuntimeFileListForWorktree } from '@/components/quick-open-file-list'
import { useModalReturnFocus } from '@/hooks/useModalReturnFocus'
import { translate } from '@/i18n/i18n'
import {
  parseQuickOpenInstallRgGuidance,
  QuickOpenInstallRgGuidance
} from '@/components/quick-open-install-rg-guidance'

const QUICK_OPEN_CLOSE_LINGER_MS = 300

function FooterKey({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="rounded-full border border-border/60 bg-muted/35 px-2 py-0.5 text-[10px] font-medium text-foreground/85">
      {children}
    </span>
  )
}

function QuickOpenHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="py-6 px-4 text-center text-sm text-muted-foreground">{children}</div>
}

export default function QuickOpen(): React.JSX.Element | null {
  const visible = useAppStore((s) => s.activeModal === 'quick-open')
  const [lingering, setLingering] = useState(visible)
  useEffect(() => {
    if (visible) {
      setLingering(true)
      return
    }
    // Why: keep scan cancellation and the dialog exit animation mounted before releasing remote file state.
    const timer = window.setTimeout(() => setLingering(false), QUICK_OPEN_CLOSE_LINGER_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!visible && !lingering) {
    return null
  }
  return <QuickOpenContent visible={visible} />
}

function QuickOpenContent({ visible }: { visible: boolean }): React.JSX.Element {
  const closeModal = useAppStore((s) => s.closeModal)
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeWorktree = useActiveWorktree()

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const parsedTarget = useMemo(() => parseQuickOpenQueryTarget(deferredQuery), [deferredQuery])
  const absoluteQuery = isQuickOpenAbsolutePath(parsedTarget.pathQuery)
  const textQuery = parseQuickOpenTextQuery(deferredQuery)
  const goToLine = textQuery === null ? parseQuickOpenGoToLine(deferredQuery) : null
  const fileMode = textQuery === null && goToLine === null
  const [openError, setOpenError] = useState<string | null>(null)
  const { opening, invalidate, begin } = useQuickOpenInteraction(activeWorktreeId)
  const [selectedPath, setSelectedPath] = useState('')
  const worktreePath = activeWorktree?.path ?? null
  const history = useQuickOpenHistory(activeWorktreeId, worktreePath)
  const textSearch = useQuickOpenTextSearch(
    visible ? activeWorktreeId : null,
    worktreePath,
    textQuery
  )
  const textRows = useMemo(
    () => (textSearch.result ? quickOpenTextSearchRows(textSearch.result) : []),
    [textSearch.result]
  )
  const activeEditorFile = useAppStore((s) =>
    s.activeTabType === 'editor'
      ? (s.openFiles.find((file) => file.id === s.activeFileId) ?? null)
      : null
  )
  const { files, loading, loadError, truncated, recentError } = useRuntimeFileListForWorktree({
    enabled: visible && !absoluteQuery && fileMode,
    worktreeId: activeWorktreeId,
    query: parsedTarget.pathQuery,
    recentPaths: history
  })

  // Why: Radix's onCloseAutoFocus restore is suppressed below, so dismissing
  // the dialog (Esc / click-away) would otherwise leave the active panel
  // unfocused. This returns focus to the surface that was active on open.
  const { captureReturnFocus, skipReturnFocus } = useModalReturnFocus(visible)

  // Why: reset input only on open. Keeping this out of the file-load effect
  // prevents unrelated store updates (which can produce a new excludePaths
  // array reference) from wiping a query the user is currently typing.
  const [previousVisible, setPreviousVisible] = useState(visible)
  if (visible !== previousVisible) {
    setPreviousVisible(visible)
    if (visible && query !== '') {
      setQuery('')
    }
  }

  const effectiveTarget = useMemo(
    () =>
      files.includes(deferredQuery.trim()) ? { pathQuery: deferredQuery.trim() } : parsedTarget,
    [files, deferredQuery, parsedTarget]
  )
  const filtered = useMemo(() => {
    if (absoluteQuery) {
      return [{ path: parsedTarget.pathQuery, score: 0 }]
    }
    return rankQuickOpenFilesWithHistory(effectiveTarget.pathQuery, files, history)
  }, [absoluteQuery, parsedTarget.pathQuery, effectiveTarget.pathQuery, files, history])

  const changesByPath = useQuickOpenChanges(activeWorktreeId)
  const openPath = useCallback(
    async (
      selectedPath: string,
      navigation: QuickOpenQueryTarget,
      rawQuery?: string,
      matchLength?: number
    ) => {
      if (!activeWorktreeId || !worktreePath || opening) {
        return
      }
      const interaction = begin()
      setOpenError(null)
      const target = resolveQuickOpenTarget(selectedPath, navigation, changesByPath)
      try {
        if (target.kind === 'diff') {
          openQuickOpenChange(activeWorktreeId, worktreePath, target, matchLength)
        } else {
          await openQuickOpenFile(
            selectedPath,
            activeWorktreeId,
            worktreePath,
            navigation,
            rawQuery,
            interaction.assertCurrent
          )
        }
        interaction.assertCurrent()
        skipReturnFocus()
        closeModal()
      } catch (error) {
        if (interaction.isCurrent()) {
          setOpenError(error instanceof Error ? error.message : String(error))
        }
      } finally {
        interaction.finish()
      }
    },
    [activeWorktreeId, worktreePath, opening, begin, closeModal, skipReturnFocus, changesByPath]
  )

  const handleSelect = useCallback(
    (path: string) => openPath(path, effectiveTarget, deferredQuery),
    [openPath, effectiveTarget, deferredQuery]
  )

  const handleTextRowSelect = useCallback(
    (row: QuickOpenTextRow) => {
      void (row.kind === 'match'
        ? openPath(
            row.relativePath,
            { pathQuery: row.relativePath, line: row.line, column: row.column },
            undefined,
            row.matchLength
          )
        : openPath(row.relativePath, { pathQuery: row.relativePath }))
    },
    [openPath]
  )

  const handleGoToLine = useCallback(() => {
    if (!activeEditorFile || !goToLine?.line) {
      return
    }
    closeModal()
    scheduleEditorLineReveal(
      useAppStore.getState,
      activeEditorFile.filePath,
      goToLine.line,
      goToLine.column,
      activeEditorFile.id
    )
  }, [activeEditorFile, goToLine?.line, goToLine?.column, closeModal])

  const itemValues = fileMode
    ? filtered.map((item) => item.path)
    : textQuery !== null
      ? textRows.map((row) => row.key)
      : activeEditorFile && goToLine?.line
        ? [QUICK_OPEN_GO_TO_LINE_VALUE]
        : []
  const showsMoreMatches = fileMode
    ? truncated && !loading && !loadError
    : Boolean(textQuery && textSearch.result?.truncated)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        invalidate()
        closeModal()
      }
    },
    [closeModal, invalidate]
  )

  const handleCloseAutoFocus = useCallback((e: Event) => {
    // Why: prevent Radix from stealing focus to the trigger element.
    e.preventDefault()
  }, [])

  const handleOpenAutoFocus = useCallback(() => {
    captureReturnFocus()
  }, [captureReturnFocus])

  return (
    <CommandDialog
      open={visible}
      onOpenChange={handleOpenChange}
      shouldFilter={false}
      commandProps={{
        value: itemValues.includes(selectedPath) ? selectedPath : (itemValues[0] ?? ''),
        onValueChange: setSelectedPath
      }}
      onOpenAutoFocus={handleOpenAutoFocus}
      onCloseAutoFocus={handleCloseAutoFocus}
      title={translate('auto.components.QuickOpen.ec31e058f7', 'Go to file')}
      description={translate('auto.components.QuickOpen.9e97f08d0f', 'Search for a file to open')}
    >
      <CommandInput
        placeholder={translate(
          'quickOpen.placeholder',
          'Go to file... (% search text, : go to line)'
        )}
        value={query}
        onValueChange={(value) => {
          invalidate()
          setQuery(value)
          setSelectedPath('')
          setOpenError(null)
        }}
        className="!h-9 !py-2"
      />
      <CommandList className="p-2">
        {recentError ? (
          <div role="status" className="px-3 py-2 text-xs text-muted-foreground">
            {recentError}
          </div>
        ) : null}
        {openError ? (
          <div role="alert" className="px-3 py-2 text-xs text-destructive">
            {openError}
          </div>
        ) : null}
        {textQuery !== null ? (
          !textQuery.trim() ? (
            <QuickOpenHint>
              {translate('quickOpen.textSearchHint', 'Type text to search for in every file.')}
            </QuickOpenHint>
          ) : textSearch.error ? (
            <QuickOpenHint>{textSearch.error}</QuickOpenHint>
          ) : textRows.length > 0 ? (
            <QuickOpenTextItems
              rows={textRows}
              changesByPath={changesByPath}
              disabled={opening}
              onSelect={handleTextRowSelect}
            />
          ) : (
            <QuickOpenHint>
              {textSearch.loading
                ? translate('quickOpen.textSearching', 'Searching...')
                : translate('quickOpen.textNoMatches', 'No matching text.')}
            </QuickOpenHint>
          )
        ) : goToLine ? (
          !activeEditorFile ? (
            <QuickOpenHint>
              {translate('quickOpen.goToLineNoFile', 'Open a file to go to a line.')}
            </QuickOpenHint>
          ) : goToLine.line ? (
            <QuickOpenGoToLineItem
              relativePath={activeEditorFile.relativePath}
              line={goToLine.line}
              column={goToLine.column}
              onSelect={handleGoToLine}
            />
          ) : (
            <QuickOpenHint>
              {translate(
                'quickOpen.goToLineHint',
                'Type a line number to go to in the current file.'
              )}
            </QuickOpenHint>
          )
        ) : loading && !absoluteQuery ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {translate('auto.components.QuickOpen.722a21e1a8', 'Loading files...')}
          </div>
        ) : loadError && !absoluteQuery ? (
          (() => {
            const guidance = parseQuickOpenInstallRgGuidance(loadError)
            return guidance ? (
              <QuickOpenInstallRgGuidance
                reason={guidance.reason}
                command={guidance.command}
                guidance={guidance.guidance}
              />
            ) : (
              <div className="py-6 px-4 text-center text-sm text-muted-foreground whitespace-pre-wrap">
                {loadError}
              </div>
            )
          })()
        ) : filtered.length === 0 ? (
          <CommandEmpty>
            {translate('auto.components.QuickOpen.74e2e1b3e4', 'No matching files.')}
          </CommandEmpty>
        ) : (
          filtered.map((item) => (
            <QuickOpenFileItem
              key={item.path}
              path={item.path}
              change={changesByPath.get(item.path)}
              disabled={opening}
              onSelect={(path) => void handleSelect(path)}
            />
          ))
        )}
        {showsMoreMatches ? (
          <div className="px-3 py-2 text-center text-xs text-muted-foreground">
            {translate(
              'quickOpen.moreMatchesAvailable',
              'More matches may be available. Refine your search to narrow the results.'
            )}
          </div>
        ) : null}
      </CommandList>
      <div className="flex items-center justify-end border-t border-border/60 px-3.5 py-2.5 text-[11px] text-muted-foreground/82">
        <div className="flex items-center gap-2">
          <FooterKey>{translate('auto.components.QuickOpen.250e5b2dfb', 'Enter')}</FooterKey>
          <span>{translate('auto.components.QuickOpen.61b1c871a6', 'Open')}</span>
          <FooterKey>{translate('auto.components.QuickOpen.95fccbae88', 'Esc')}</FooterKey>
          <span>{translate('auto.components.QuickOpen.73b2c581f1', 'Close')}</span>
          <FooterKey>↑↓</FooterKey>
          <span>{translate('auto.components.QuickOpen.1dbd3f59ff', 'Move')}</span>
        </div>
      </div>
      {/* Accessibility: announce result count changes */}
      <div aria-live="polite" className="sr-only">
        {deferredQuery.trim()
          ? translate('auto.components.QuickOpen.b227d88520', '{{value0}} files found', {
              value0: filtered.length
            })
          : ''}
      </div>
    </CommandDialog>
  )
}
