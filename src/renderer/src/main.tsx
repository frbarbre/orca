// Why first, and why the import-free shim: react-dom reads
// __REACT_DEVTOOLS_GLOBAL_HOOK__ once at module evaluation, so the global has to
// exist before it. The observer below only wraps a property react-dom re-reads
// per commit, so its own import graph can evaluate whenever it likes.
import './lib/react-devtools-commit-hook-shim'
import './lib/react-commit-cascade-observer'
import './assets/main.css'

import { StrictMode } from 'react'
import { useTranslation } from 'react-i18next'
import App from './App'
import { RecoverableRenderErrorBoundary } from './components/error-boundaries/RecoverableRenderErrorBoundary'
import {
  installRendererCrashDiagnostics,
  recordRendererCrashBreadcrumb
} from './lib/crash-diagnostics'
import { installAutomationHostDiagnostic } from './components/automations/automation-host-diagnostics'
import { applyDocumentTheme } from './lib/document-theme'
import { installTypingLatencyDiagnostic } from './lib/typing-latency/diagnostic'
import { shouldEnableReactGrab } from './lib/react-grab-dev-gate'
import { I18nProvider } from './i18n/I18nProvider'
import { translate } from './i18n/i18n'
import { getOrCreateRendererRoot } from './lib/react-renderer-root'
import { primeTerminalWebglAddon } from './lib/pane-manager/pane-webgl-renderer'
import { SkillWarningPreviewLauncher } from './components/skills/SkillWarningPreviewLauncher'
import { installBrowserClientPageRenderer } from './components/browser-pane/browser-client-page-renderer-installation'
import { setMainReleaseRepoOverride } from '../../shared/release-channel'

recordRendererCrashBreadcrumb('renderer_bootstrap_started', { dev: import.meta.env.DEV })
installRendererCrashDiagnostics()
installTypingLatencyDiagnostic()
installAutomationHostDiagnostic()
// Why a build flag: the renderer cannot read the main process's env, and the fork's release links
// must point at the repo it updates from. Unset in upstream builds, which keep upstream's links.
if (import.meta.env.VITE_ORCA_RELEASES_REPO) {
  setMainReleaseRepoOverride(String(import.meta.env.VITE_ORCA_RELEASES_REPO))
}

if (
  import.meta.env.DEV &&
  shouldEnableReactGrab({
    dev: import.meta.env.DEV,
    enableFlag: import.meta.env.VITE_ENABLE_REACT_GRAB
  })
) {
  void import('react-grab').then(({ init }) => init())
  void import('react-grab/styles.css')
}

applyDocumentTheme('system', { disableTransitions: false })
const browserClientPageRenderer = installBrowserClientPageRenderer()
import.meta.hot?.dispose(() => browserClientPageRenderer?.dispose())

const rootElement = document.getElementById('root')
if (!rootElement) {
  recordRendererCrashBreadcrumb('renderer_root_missing')
  throw new Error('Renderer root element not found.')
}

function RendererRoot(): React.JSX.Element {
  useTranslation()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="app.root"
      surface="app-root"
      title={translate('app.recoverableError.rootTitle', 'Orca hit a renderer error.')}
      description={translate(
        'app.recoverableError.rootDescription',
        'The app shell could not finish rendering. Retry to remount it, or relaunch Orca if the error persists.'
      )}
    >
      <App />
      <SkillWarningPreviewLauncher />
    </RecoverableRenderErrorBoundary>
  )
}

getOrCreateRendererRoot(rootElement, import.meta.hot?.data).render(
  <StrictMode>
    <I18nProvider>
      <RendererRoot />
    </I18nProvider>
  </StrictMode>
)
recordRendererCrashBreadcrumb('renderer_bootstrap_rendered')

// Why here: the xterm WebGL addon is 243 KB, is only ever constructed once a
// terminal attaches (many frames away), and is needed by nothing during boot.
// Starting the load after the first render keeps it off the boot graph while
// leaving it resolved long before any pane can attach.
void primeTerminalWebglAddon()
