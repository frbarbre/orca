import type { GlobalSettingsBase } from './global-settings-base'
import type { LanguageServerSettingsMap } from './language-server'
import type { LinterSettingsMap } from './linter'

// Fork: kept out of global-settings-types.ts, which sits at the max-lines ceiling.
export type SectionLayout = { order?: string[]; hidden?: string[] }

export type ForkSourceControlSettings = {
  /** One list of every file changed vs the base ('all', the default), or upstream's staged/changes/committed sections. */
  sourceControlGrouping?: 'all' | 'status'
  /** Dragged order and hidden sections of the source-control panel, and of the PR panel under `pr` (`shared/source-control-sections.ts`). */
  sourceControlSectionLayout?: SectionLayout & { pr?: SectionLayout }
}

type ForkEditorSettings = {
  /** Per-language server, read through `languageServerSettings`; a missing language means on. */
  languageServers?: LanguageServerSettingsMap
  /** Per-linter switch and path, read through `linterSettings`; a missing linter means on. */
  linters?: LinterSettingsMap
  /** The cursor line's blame annotation; an unset switch means on. */
  gitBlame?: { enabled?: boolean; youForMyCommits?: boolean }
  /** Open new Claude Code tabs in the claude.ai Remote Control web view. */
  openClaudeTabsInWebView?: boolean
}

/** What GlobalSettings extends: upstream's settings base plus the fork's. */
export type ForkBaseSettings = GlobalSettingsBase & ForkSourceControlSettings & ForkEditorSettings
