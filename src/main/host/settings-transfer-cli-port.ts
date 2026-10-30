import type {
  SettingsTransferCliAction,
  SettingsTransferCliResult
} from '../../shared/settings-transfer-cli'

type SettingsTransferRequester = (
  action: SettingsTransferCliAction
) => Promise<SettingsTransferCliResult>

let requester: SettingsTransferRequester | null = null

export function setSettingsTransferRequester(next: SettingsTransferRequester | null): void {
  requester = next
}

export function requestSettingsTransfer(
  action: SettingsTransferCliAction
): Promise<SettingsTransferCliResult> {
  return requester
    ? requester(action)
    : Promise.reject(new Error('Orca has no open window to export or import settings in.'))
}
