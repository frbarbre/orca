import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SETTINGS_TRANSFER_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['settings', 'export'],
    summary: 'Export your Orca settings to a file, like Settings › Share settings',
    usage: 'orca settings export [--output <path>]',
    allowedFlags: [...GLOBAL_FLAGS, 'output'],
    notes: [
      'Exports preferences, board columns, automations, project settings, keybindings and editor themes. Accounts, tokens, API keys and local paths are left out.',
      'Without --output the JSON goes to stdout.'
    ],
    examples: [
      'orca settings export --output ~/orca-settings.json',
      'orca settings export > orca-settings.json'
    ]
  },
  {
    path: ['settings', 'import'],
    summary: 'Import an exported settings file into the running Orca, which then reloads',
    usage: 'orca settings import --file <path> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'file'],
    notes: [
      'Replaces the settings the file carries; accounts and workspaces stay as they are. Project settings apply to projects with the same git remote.'
    ],
    examples: ['orca settings import --file ~/orca-settings.json']
  }
]
