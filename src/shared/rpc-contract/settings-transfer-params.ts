import { z } from 'zod'

const MAX_SETTINGS_TRANSFER_BYTES = 5 * 1024 * 1024

export const SettingsTransferImport = z.object({
  text: z.string().min(1).max(MAX_SETTINGS_TRANSFER_BYTES)
})
