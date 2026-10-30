import { SettingsTransferImport } from '../../../../shared/rpc-contract/settings-transfer-params'
import { requestSettingsTransfer } from '../../../host/settings-transfer-cli-port'
import { defineMethod } from '../core'

export const SETTINGS_TRANSFER_METHODS = [
  defineMethod({
    name: 'settingsTransfer.export',
    permission: 'workspace',
    params: null,
    handler: () => requestSettingsTransfer({ kind: 'export' })
  }),
  defineMethod({
    name: 'settingsTransfer.import',
    permission: 'settings-write',
    params: SettingsTransferImport,
    handler: (params) => requestSettingsTransfer({ kind: 'import', text: params.text })
  })
]
