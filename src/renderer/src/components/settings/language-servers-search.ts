import {
  LANGUAGE_SERVER_LANGUAGES,
  languageServerOptions
} from '../../../../shared/language-server'
import { LINTER_IDS, LINTERS } from '../../../../shared/linter'
import { FORMATTER_IDS, FORMATTERS } from '../../../../shared/formatter'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import {
  RENDERER_FORMATTERS,
  RENDERER_LANGUAGE_SERVERS,
  RENDERER_LINTERS
} from '@/lib/language-server-languages'
import { translateSearchKeyword } from './settings-search-keywords'

export const getLanguageServersSearchEntries = createLocalizedCatalog(() => {
  const shared = [
    ...translateSearchKeyword('languageServers.search.languageServer', 'language server'),
    ...translateSearchKeyword('languageServers.search.goToDefinition', 'go to definition'),
    ...translateSearchKeyword('languageServers.search.hover', 'hover'),
    ...translateSearchKeyword('languageServers.search.references', 'references'),
    ...translateSearchKeyword('languageServers.search.lsp', 'lsp', { englishOnly: true }),
    ...translateSearchKeyword('languageServers.search.typeErrors', 'type errors'),
    ...translateSearchKeyword('languageServers.search.errors', 'errors'),
    ...translateSearchKeyword('languageServers.search.suggestions', 'suggestions'),
    ...translateSearchKeyword('languageServers.search.autocomplete', 'autocomplete'),
    ...translateSearchKeyword('languageServers.search.completion', 'completion')
  ]
  const lint = [
    ...translateSearchKeyword('languageServers.search.lint', 'lint'),
    ...translateSearchKeyword('languageServers.search.linter', 'linter'),
    ...translateSearchKeyword('languageServers.search.squiggles', 'squiggles'),
    ...translateSearchKeyword('languageServers.search.diagnostics', 'diagnostics')
  ]
  const format = [
    ...translateSearchKeyword('languageServers.search.formatter', 'formatter'),
    ...translateSearchKeyword('languageServers.search.formatOnSave', 'format on save'),
    ...translateSearchKeyword('languageServers.search.prettier', 'prettier', { englishOnly: true })
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
    })),
    ...FORMATTER_IDS.map((formatter) => ({
      title: FORMATTERS[formatter].name,
      description: RENDERER_FORMATTERS[formatter].description(),
      keywords: [...format, FORMATTERS[formatter].name]
    }))
  ]
})
