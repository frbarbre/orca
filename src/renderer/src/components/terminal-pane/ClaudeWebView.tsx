import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, RotateCw, SquareTerminal } from 'lucide-react'
import { ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE } from '../../../../shared/browser-guest-web-preferences'
import type { ClaudeRemoteSessionUrlResult } from '../../../../shared/claude-remote-session'
import { moveFocusToRendererBeforeWebviewDetach } from '@/components/browser-pane/host-guest/webview-registry'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

type PageState = 'loading' | 'ready' | 'failed'

function attachClaudeWebview(
  container: HTMLDivElement,
  partition: string,
  url: string,
  onState: (state: PageState) => void
): { reload: () => void; detach: () => void } {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Electron's renderer creates a WebviewTag for the 'webview' tag, which DOM typings do not know.
  const webview = document.createElement('webview') as Electron.WebviewTag
  webview.setAttribute('partition', partition)
  webview.setAttribute('webpreferences', ORCA_BROWSER_GUEST_WEB_PREFERENCES_ATTRIBUTE)
  webview.setAttribute('allowpopups', '')
  webview.setAttribute(
    'aria-label',
    translate('auto.components.terminal.pane.ClaudeWebView.pageLabel', 'Claude Code on the web')
  )
  webview.className = 'flex h-full w-full border-none'
  let loadedOnce = false
  // Why: claude.ai redirects and re-navigates after its first load; covering it each time flickers.
  const onStart = (): void => {
    if (!loadedOnce) {
      onState('loading')
    }
  }
  const onStop = (): void => {
    loadedOnce = true
    onState('ready')
  }
  const onFail = (event: Electron.DidFailLoadEvent): void => {
    // -3 is ERR_ABORTED: a navigation superseded by another, not a failure.
    if (event.isMainFrame && event.errorCode !== -3) {
      onState('failed')
    }
  }
  webview.addEventListener('did-start-loading', onStart)
  webview.addEventListener('did-stop-loading', onStop)
  webview.addEventListener('did-fail-load', onFail)
  container.appendChild(webview)
  webview.setAttribute('src', url)
  return {
    reload: () => webview.reload(),
    detach: () => {
      webview.removeEventListener('did-start-loading', onStart)
      webview.removeEventListener('did-stop-loading', onStop)
      webview.removeEventListener('did-fail-load', onFail)
      moveFocusToRendererBeforeWebviewDetach(webview)
      webview.remove()
    }
  }
}

function unavailableMessage(result: ClaudeRemoteSessionUrlResult | 'failed'): string {
  if (result === 'failed') {
    return translate(
      'auto.components.terminal.pane.ClaudeWebView.loadFailed',
      'claude.ai could not be loaded.'
    )
  }
  if (result.status === 'remote-control-off') {
    return translate(
      'auto.components.terminal.pane.ClaudeWebView.remoteControlOff',
      'Remote Control is not on for this session. Run /remote-control in Claude Code, then try again.'
    )
  }
  return translate(
    'auto.components.terminal.pane.ClaudeWebView.sessionNotFound',
    'This Claude Code session could not be found on this machine.'
  )
}

export function ClaudeWebView({
  sessionId,
  onSwitchToTerminal
}: {
  sessionId: string
  onSwitchToTerminal: () => void
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const reloadRef = useRef<(() => void) | null>(null)
  const [resolved, setResolved] = useState<ClaudeRemoteSessionUrlResult | 'failed' | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let disposed = false
    let detach: (() => void) | undefined
    setResolved(null)
    setPageState('loading')
    void Promise.all([
      window.api.claudeRemoteSession.resolveUrl({ sessionId }),
      window.api.browser.sessionResolvePartition({ profileId: null })
    ])
      .then(([result, partition]) => {
        if (disposed) {
          return
        }
        if (result.status !== 'ready' || !partition || !containerRef.current) {
          setResolved(result.status === 'ready' ? 'failed' : result)
          return
        }
        setResolved(result)
        const attached = attachClaudeWebview(
          containerRef.current,
          partition,
          result.url,
          (next) => {
            if (!disposed) {
              setPageState(next)
            }
          }
        )
        detach = attached.detach
        reloadRef.current = attached.reload
      })
      .catch(() => {
        if (!disposed) {
          setResolved('failed')
        }
      })
    return () => {
      disposed = true
      reloadRef.current = null
      detach?.()
    }
  }, [sessionId, attempt])

  const unavailable =
    resolved === 'failed' || (resolved !== null && resolved.status !== 'ready')
      ? unavailableMessage(resolved)
      : pageState === 'failed'
        ? unavailableMessage('failed')
        : null
  const loading = !unavailable && (resolved === null || pageState === 'loading')

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Why pr-12: the pane's chromeless split/close controls float over this corner. */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border py-1 pr-12 pl-2">
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {translate('auto.components.terminal.pane.ClaudeWebView.title', 'Claude web view')}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={translate('auto.components.terminal.pane.ClaudeWebView.reload', 'Reload')}
          onClick={() => (reloadRef.current ? reloadRef.current() : setAttempt((n) => n + 1))}
        >
          <RotateCw />
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={onSwitchToTerminal}>
          <SquareTerminal />
          {translate(
            'components.tab.bar.SortableTabContextMenu.switchToTerminalView',
            'Switch to terminal view'
          )}
        </Button>
      </div>
      <div ref={containerRef} className="relative flex min-h-0 min-w-0 flex-1 bg-background">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {unavailable ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
            <AlertCircle className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">{unavailable}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAttempt((n) => n + 1)}
            >
              {translate('auto.components.terminal.pane.ClaudeWebView.retry', 'Try again')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
