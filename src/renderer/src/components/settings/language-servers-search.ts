import {
  LANGUAGE_SERVER_LANGUAGES,
  languageServerOptions
} from '../../../../shared/language-server'
import { LINTER_IDS, LINTERS } from '../../../../shared/linter'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { RENDERER_LANGUAGE_SERVERS, RENDERER_LINTERS } from '@/lib/language-server-languages'
import { translateSearchKeyword } from './settings-search-keywords'

export const getLanguageServersSearchEntries = createLocalizedCatalog(() => {
  const shared = [
    ...translateSearchKeyword('languageServers.search.languageServer', 'language server'),
    ...translateSearchKeyword('languageServers.search.goToDefinition', 'go to definition'),
    ...translateSearchKeyword('languageServers.search.hover', 'hover'),
    ...translateSearchKeyword('languageServers.search.references', 'references'),
    ...translateSearchKeyword('languageServers.search.lsp', 'lsp', { englishOnly: true }),
    ...translateSearchKeyword('languageServers.search.typeErrors', 'type errors'),
    ...translateSearchKeyword('languageServers.search.errors', 'errors')
  ]
  const lint = [
    ...translateSearchKeyword('languageServers.search.lint', 'lint'),
    ...translateSearchKeyword('languageServers.search.linter', 'linter'),
    ...translateSearchKeyword('languageServers.search.squiggles', 'squiggles'),
    ...translateSearchKeyword('languageServers.search.diagnostics', 'diagnostics')
  ]
  return [
    ...LANGUAGE_SERVER_LANGUAGES.map((language) => ({
      title: RENDERER_LANGUAGE_SERVERS[language].label(),
      description: RENDERER_LANGUAGE_SERVERS[language].description(),
      keywords: [
        ...shared,
        language,
        ...Object.values(languageServerOptions(language)).flatMap((server) => [
          server.name,
          server.command
        ])
      ]
    })),
    ...LINTER_IDS.map((linter) => ({
      title: LINTERS[linter].name,
      description: RENDERER_LINTERS[linter].description(),
      keywords: [...lint, LINTERS[linter].name]
    }))
  ]
})
