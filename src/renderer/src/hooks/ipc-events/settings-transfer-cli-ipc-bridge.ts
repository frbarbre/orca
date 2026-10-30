import {
  applySettingsImport,
  buildSettingsExportText,
  describeSettingsBundle
} from '@/lib/settings-transfer-actions'
import { parseSettingsTransfer } from '../../../../shared/settings-transfer'
import type { SettingsTransferCliRequest } from '../../../../shared/settings-transfer-cli'

export async function answerSettingsTransferCliRequest(
  request: SettingsTransferCliRequest
): Promise<void> {
  const { requestId } = request
  const reply = window.api.settingsTransfer.replyCliRequest
  try {
    if (request.kind === 'export') {
      reply({ requestId, text: await buildSettingsExportText() })
      return
    }
    const parsed = parseSettingsTransfer(request.text)
    if (!parsed.ok) {
      reply({ requestId, error: parsed.error })
      return
    }
    await applySettingsImport(parsed.bundle)
    reply({ requestId, summary: describeSettingsBundle(parsed.bundle) })
    window.location.reload()
  } catch (error) {
    reply({ requestId, error: error instanceof Error ? error.message : String(error) })
  }
}

export function installSettingsTransferCliBridge(): () => void {
  return window.api.settingsTransfer.onCliRequest((request) => {
    void answerSettingsTransferCliRequest(request)
  })
}
