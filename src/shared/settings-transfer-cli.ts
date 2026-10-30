export type SettingsTransferCliAction = { kind: 'export' } | { kind: 'import'; text: string }

export type SettingsTransferCliRequest = SettingsTransferCliAction & { requestId: string }

export type SettingsTransferCliResult = { text: string } | { summary: string }

export type SettingsTransferCliReply = { requestId: string } & (
  | SettingsTransferCliResult
  | { error: string }
)
