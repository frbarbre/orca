import type * as Monaco from 'monaco-editor'
import type { LanguageServerLanguage } from '../../../shared/language-server'
import type { LinterId } from '../../../shared/linter'
import { translate } from '@/i18n/i18n'
import {
  builtInTypeScriptDefinition,
  builtInTypeScriptHover,
  builtInTypeScriptReferences
} from './built-in-typescript-fallback'

type Model = Monaco.editor.ITextModel
type Position = Monaco.Position

/** What the editor asks when the language server is off or cannot answer. */
export type LanguageServerFallback = {
  definition: (model: Model, position: Position) => Promise<Monaco.languages.Location[] | null>
  hover: (model: Model, position: Position) => Promise<Monaco.languages.Hover | null>
  references: (model: Model, position: Position) => Promise<Monaco.languages.Location[] | null>
}

type RendererLanguage = {
  label: () => string
  description: () => string
  fallback?: (monaco: typeof Monaco, monacoTS: typeof Monaco.typescript) => LanguageServerFallback
}

// Fork: the renderer's half of the language server registry (`shared/language-server.ts`).
export const RENDERER_LANGUAGE_SERVERS: Record<LanguageServerLanguage, RendererLanguage> = {
  python: {
    label: () => translate('languageServers.python.label', 'Python'),
    description: () =>
      translate(
        'languageServers.python.description',
        "Runs in the project's venv, or the main checkout's when a worktree has none."
      )
  },
  typescript: {
    label: () => translate('languageServers.typescript.label', 'TypeScript and JavaScript'),
    description: () =>
      translate(
        'languageServers.typescript.description',
        "Runs from the project's node_modules. Off falls back to the editor's built-in TypeScript, which only knows open files."
      ),
    fallback: (monaco, monacoTS) => ({
      definition: (model, position) =>
        builtInTypeScriptDefinition(monaco, monacoTS, model, position),
      hover: (model, position) => builtInTypeScriptHover(monaco, monacoTS, model, position),
      references: (model, position) =>
        builtInTypeScriptReferences(monaco, monacoTS, model, position)
    })
  }
}

// Fork: the renderer's half of the linter registry (`shared/linter.ts`).
export const RENDERER_LINTERS: Record<LinterId, { description: () => string }> = {
  oxlint: {
    description: () =>
      translate(
        'linters.oxlint.description',
        "Lint squiggles in JavaScript and TypeScript files, with the project's own oxlint and config. Projects without an oxlint config get none."
      )
  }
}
