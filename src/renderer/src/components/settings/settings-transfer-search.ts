import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translateSearchKeyword } from './settings-search-keywords'

export const getSettingsTransferSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('auto.components.settings.transfer.search.title', 'Share settings'),
    description: translate(
      'auto.components.settings.transfer.search.description',
      'Export settings to a file, or import a colleague’s.'
    ),
    keywords: [
      ...translateSearchKeyword('auto.components.settings.transfer.search.export', 'export'),
      ...translateSearchKeyword('auto.components.settings.transfer.search.import', 'import'),
      ...translateSearchKeyword('auto.components.settings.transfer.search.share', 'share'),
      ...translateSearchKeyword('auto.components.settings.transfer.search.backup', 'backup'),
      ...translateSearchKeyword('auto.components.settings.transfer.search.config', 'config')
    ]
  }
])
