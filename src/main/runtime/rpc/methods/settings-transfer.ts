import { SettingsTransferImport } from '../../../../shared/rpc-contract/settings-transfer-params'
import { requestSettingsTransferFromWindow } from '../../../window/settings-transfer-cli-relay'
import { defineMethod } from '../core'

export const SETTINGS_TRANSFER_METHODS = [
  defineMethod({
    name: 'settingsTransfer.export',
    permission: 'workspace',
    params: null,
    handler: () => requestSettingsTransferFromWindow({ kind: 'export' })
  }),
  defineMethod({
    name: 'settingsTransfer.import',
    permission: 'settings-write',
    params: SettingsTransferImport,
    handler: (params) => requestSettingsTransferFromWindow({ kind: 'import', text: params.text })
  })
]
