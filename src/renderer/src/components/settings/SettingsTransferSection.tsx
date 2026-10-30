import React, { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import {
  applySettingsImport,
  buildSettingsExportText,
  describeSettingsBundle
} from '@/lib/settings-transfer-actions'
import {
  parseSettingsTransfer,
  type SettingsTransferBundle
} from '../../../../shared/settings-transfer'
import { SettingsSubsectionHeader } from './SettingsFormControls'

export function SettingsTransferSection(): React.JSX.Element {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<SettingsTransferBundle | null>(null)

  const exportSettings = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.settingsTransfer.save(await buildSettingsExportText())
      if (result.ok) {
        toast.success(
          translate('auto.components.settings.transfer.exported', 'Settings exported to {{path}}', {
            path: result.path
          })
        )
      } else if (result.error) {
        toast.error(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const chooseImport = async (): Promise<void> => {
    const result = await window.api.settingsTransfer.open()
    if (!result.ok) {
      if (result.error) {
        toast.error(result.error)
      }
      return
    }
    const parsed = parseSettingsTransfer(result.text)
    if (!parsed.ok) {
      toast.error(parsed.error)
      return
    }
    setPending(parsed.bundle)
  }

  const applyImport = async (bundle: SettingsTransferBundle): Promise<void> => {
    setBusy(true)
    try {
      await applySettingsImport(bundle)
      // Why a reload: stored values are sanitized when Orca loads them, so the imported ones go
      // through the same checks as anything Orca saved itself.
      window.location.reload()
    } catch (error) {
      setBusy(false)
      toast.error(
        translate('auto.components.settings.transfer.importFailed', 'Import failed: {{reason}}', {
          reason: error instanceof Error ? error.message : String(error)
        })
      )
    }
  }

  return (
    <section className="space-y-3">
      <SettingsSubsectionHeader
        title={translate('auto.components.settings.transfer.title', 'Share settings')}
        description={translate(
          'auto.components.settings.transfer.description',
          'Export your preferences, board columns, automations, project settings, keybindings and editor themes to a file a colleague can import. Project settings apply to the projects they have with the same git remote. Accounts, tokens, API keys and local paths are left out.'
        )}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void exportSettings()}>
          <Download className="size-3.5" />
          {translate('auto.components.settings.transfer.export', 'Export settings…')}
        </Button>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void chooseImport()}>
          <Upload className="size-3.5" />
          {translate('auto.components.settings.transfer.import', 'Import settings…')}
        </Button>
      </div>
      {pending ? (
        <div className="space-y-2 rounded-md border border-border p-3 text-xs">
          <p>
            {translate(
              'auto.components.settings.transfer.confirm',
              'This replaces your {{summary}}. Your accounts and workspaces stay as they are. Orca reloads afterwards.',
              { summary: describeSettingsBundle(pending) }
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="xs" disabled={busy} onClick={() => setPending(null)}>
              {translate('auto.components.settings.transfer.cancel', 'Cancel')}
            </Button>
            <Button size="xs" disabled={busy} onClick={() => void applyImport(pending)}>
              {translate('auto.components.settings.transfer.apply', 'Import and reload')}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
